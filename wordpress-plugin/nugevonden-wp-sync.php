<?php
/**
 * Plugin Name: Nugevonden WP Sync
 * Description: Haalt betaalde Nugevonden-orders zelf op en zet ze als concept-blogpost in WordPress — de site vraagt Nugevonden actief (pull), in plaats van dat Nugevonden naar de site stuurt (push). Nodig wanneer hosting-beveiliging (bijv. SiteGround AI Anti-Bot Protection) binnenkomende automatische verzoeken blokkeert, ongeacht het pad — uitgaande verzoeken die de site zelf initieert (zoals dit) raakt die beveiliging niet. Meldt ook de categorieën van deze site, zodat een klant er bij het bestellen zelf een kan kiezen zonder dat iemand ze handmatig moet invoeren. Zodra het concept hier gepubliceerd wordt, gaat de live link automatisch terug naar Nugevonden.
 * Version: 1.5.1
 * Author: Nugevonden
 */

if (!defined('ABSPATH')) {
    exit;
}

define('NUGEVONDEN_SYNC_OPTION', 'nugevonden_sync_secret');
define('NUGEVONDEN_SYNC_API_BASE', 'https://mijn.nugevonden.nl');
define('NUGEVONDEN_SYNC_CRON_HOOK', 'nugevonden_sync_event');
define('NUGEVONDEN_SYNC_LAST_IMAGE_ERROR', 'nugevonden_sync_last_image_error');
define('NUGEVONDEN_SYNC_AUTHOR_OPTION', 'nugevonden_sync_author_id');

// wp_insert_post() falls back to get_current_user_id() for post_author
// when it isn't set explicitly — during an automatic sync (WP-Cron, no
// logged-in visitor) that's 0, so the post ends up with no author at all.
// Uses the admin-picked author (settings page below) when set, otherwise
// the first administrator account found.
function nugevonden_sync_author_id() {
    $author_id = (int) get_option(NUGEVONDEN_SYNC_AUTHOR_OPTION);
    if ($author_id) {
        return $author_id;
    }
    $admins = get_users(['role' => 'administrator', 'number' => 1, 'orderby' => 'ID']);
    return $admins ? (int) $admins[0]->ID : 0;
}

function nugevonden_sync_get_secret() {
    $secret = get_option(NUGEVONDEN_SYNC_OPTION);
    if (!$secret) {
        $secret = wp_generate_password(40, false);
        update_option(NUGEVONDEN_SYNC_OPTION, $secret);
    }
    return $secret;
}

// Reports this site's own categories to Nugevonden — a local WordPress
// database read (get_categories), not an HTTP request in, so hosting-level
// bot protection never sees it. Runs on every sync cycle so the list at
// Nugevonden stays current without anyone typing category IDs in by hand.
function nugevonden_sync_categories() {
    $secret = nugevonden_sync_get_secret();
    $wp_categories = get_categories(['hide_empty' => false]);
    $categories = array_map(function ($cat) {
        return ['id' => $cat->term_id, 'name' => $cat->name];
    }, $wp_categories);

    $response = wp_remote_post(NUGEVONDEN_SYNC_API_BASE . '/api/wp-sync/categories', [
        'timeout' => 20,
        'headers' => ['Content-Type' => 'application/json'],
        'body'    => json_encode(['secret' => $secret, 'categories' => $categories]),
    ]);
    if (is_wp_error($response)) {
        error_log('Nugevonden sync: categorieën melden mislukt: ' . $response->get_error_message());
    }
}

// Downloads the image and attaches it directly, instead of using
// media_sideload_image()/download_url() — those write to a local temp file
// first (wp_tempnam()), which some locked-down hosting (seen on
// SiteGround) blocks silently: the whole thing fails before it ever makes
// the HTTP request for the image, so nothing shows up in Nugevonden's own
// logs either. Fetching the bytes with wp_remote_get() and writing them
// straight into the uploads folder via wp_upload_bits() has no such
// dependency.
function nugevonden_sync_attach_image($post_id, $image_url) {
    $response = wp_remote_get($image_url, ['timeout' => 30]);
    if (is_wp_error($response)) {
        return $response;
    }
    $status = wp_remote_retrieve_response_code($response);
    if ($status !== 200) {
        return new WP_Error('nugevonden_image_http', 'Ophalen van de afbeelding gaf status ' . $status);
    }
    $body = wp_remote_retrieve_body($response);
    if (empty($body)) {
        return new WP_Error('nugevonden_image_empty', 'De afbeelding was leeg');
    }

    $content_type = wp_remote_retrieve_header($response, 'content-type');
    $ext = 'jpg';
    if (is_string($content_type)) {
        if (strpos($content_type, 'png') !== false) {
            $ext = 'png';
        } elseif (strpos($content_type, 'webp') !== false) {
            $ext = 'webp';
        } elseif (strpos($content_type, 'gif') !== false) {
            $ext = 'gif';
        }
    }

    $filename = 'nugevonden-' . $post_id . '-' . time() . '.' . $ext;
    $upload = wp_upload_bits($filename, null, $body);
    if (!empty($upload['error'])) {
        return new WP_Error('nugevonden_image_upload', is_string($upload['error']) ? $upload['error'] : 'Opslaan van de afbeelding mislukt');
    }

    require_once ABSPATH . 'wp-admin/includes/image.php';
    $attachment_id = wp_insert_attachment([
        'post_mime_type' => $content_type ?: 'image/jpeg',
        'post_title'     => sanitize_file_name($filename),
        'post_status'    => 'inherit',
    ], $upload['file'], $post_id);

    if (!$attachment_id || is_wp_error($attachment_id)) {
        return new WP_Error('nugevonden_image_attach', 'Aanmaken van het media-item mislukte');
    }

    $metadata = wp_generate_attachment_metadata($attachment_id, $upload['file']);
    wp_update_attachment_metadata($attachment_id, $metadata);
    set_post_thumbnail($post_id, $attachment_id);

    return $attachment_id;
}

function nugevonden_sync_run() {
    $secret = nugevonden_sync_get_secret();

    nugevonden_sync_categories();

    $pending_url = NUGEVONDEN_SYNC_API_BASE . '/api/wp-sync/pending?secret=' . rawurlencode($secret);

    $response = wp_remote_get($pending_url, ['timeout' => 20]);
    if (is_wp_error($response)) {
        return;
    }

    $body = json_decode(wp_remote_retrieve_body($response), true);
    if (empty($body['items']) || !is_array($body['items'])) {
        return;
    }

    foreach ($body['items'] as $item) {
        if (empty($item['id']) || empty($item['title']) || empty($item['content'])) {
            continue;
        }

        // Content comes pre-sanitized from Nugevonden's own server, and this
        // whole exchange is authenticated with the secret above — not
        // re-filtered through wp_kses here, since WordPress's default post
        // filter strips the inline color/alignment styling Nugevonden's
        // editor already allowed.
        //
        // Created as a draft, not published outright — the admin reviews
        // and clicks Publish themselves in WordPress; nugevonden_on_publish()
        // below reports the real live URL back the moment that happens.
        $post_args = [
            'post_title'   => sanitize_text_field($item['title']),
            'post_content' => $item['content'],
            'post_status'  => 'draft',
            'post_type'    => 'post',
        ];
        $author_id = nugevonden_sync_author_id();
        if ($author_id) {
            $post_args['post_author'] = $author_id;
        }
        if (!empty($item['categoryId'])) {
            $post_args['post_category'] = [(int) $item['categoryId']];
        }

        $post_id = wp_insert_post($post_args, true);

        if (is_wp_error($post_id)) {
            continue;
        }

        // Tags this draft as "belongs to this Nugevonden order item" so
        // nugevonden_on_publish() below knows to report it once the admin
        // actually publishes it.
        update_post_meta($post_id, '_nugevonden_order_item_id', $item['id']);

        // Marks the item claimed at Nugevonden (so the next poll doesn't
        // offer it again and create a second draft) without claiming it's
        // live — it isn't, yet. Sent right after the post exists, before
        // the image attempt below, so a stuck or failing image download
        // can never keep this confirmation from going out.
        wp_remote_post(NUGEVONDEN_SYNC_API_BASE . '/api/wp-sync/ack', [
            'timeout' => 20,
            'headers' => ['Content-Type' => 'application/json'],
            'body'    => json_encode([
                'secret'      => $secret,
                'orderItemId' => $item['id'],
                'status'      => 'draft',
            ]),
        ]);

        // Image attempt happens after the confirmation, wrapped in
        // try/catch so any unexpected failure here is just a missing
        // image, never a missing confirmation. Any failure is saved as a
        // plain-language message on the settings page instead of only
        // going to a PHP error log nobody but a developer could find.
        if (!empty($item['imageUrl'])) {
            try {
                $result = nugevonden_sync_attach_image($post_id, esc_url_raw($item['imageUrl']));
                if (is_wp_error($result)) {
                    $message = 'Post "' . get_the_title($post_id) . '" (' . current_time('d-m-Y H:i') . '): ' . $result->get_error_message();
                    update_option(NUGEVONDEN_SYNC_LAST_IMAGE_ERROR, $message);
                    error_log('Nugevonden sync: afbeelding toevoegen mislukt voor post ' . $post_id . ': ' . $result->get_error_message());
                } else {
                    delete_option(NUGEVONDEN_SYNC_LAST_IMAGE_ERROR);
                }
            } catch (\Throwable $e) {
                $message = 'Post "' . get_the_title($post_id) . '" (' . current_time('d-m-Y H:i') . '): ' . $e->getMessage();
                update_option(NUGEVONDEN_SYNC_LAST_IMAGE_ERROR, $message);
                error_log('Nugevonden sync: afbeelding toevoegen mislukt voor post ' . $post_id . ': ' . $e->getMessage());
            }
        }
    }
}

// Fires the moment a draft this plugin created gets actually published —
// whether the admin clicks "Publish" right away or edits it for a few
// days first. Reports the real live URL back to Nugevonden so both the
// admin's and the customer's own order view pick it up.
add_action('transition_post_status', function ($new_status, $old_status, $post) {
    if ($new_status !== 'publish' || $old_status === 'publish') {
        return;
    }
    $order_item_id = get_post_meta($post->ID, '_nugevonden_order_item_id', true);
    if (!$order_item_id) {
        return;
    }

    wp_remote_post(NUGEVONDEN_SYNC_API_BASE . '/api/wp-sync/ack', [
        'timeout' => 20,
        'headers' => ['Content-Type' => 'application/json'],
        'body'    => json_encode([
            'secret'      => nugevonden_sync_get_secret(),
            'orderItemId' => $order_item_id,
            'liveUrl'     => get_permalink($post->ID),
        ]),
    ]);
}, 10, 3);

// Automatic: WordPress's own cron checks every minute (fires on site
// traffic; for reliable timing regardless of visits, set up a real server
// cron on SiteGround Site Tools -> Devs -> Cron Jobs that hits wp-cron.php
// every minute — standard WordPress practice).
add_filter('cron_schedules', function ($schedules) {
    $schedules['nugevonden_one_minute'] = ['interval' => 60, 'display' => 'Elke minuut (Nugevonden)'];
    return $schedules;
});

add_action(NUGEVONDEN_SYNC_CRON_HOOK, 'nugevonden_sync_run');

// Must-use plugins never fire activation hooks, so schedule directly if the
// event isn't registered yet — this runs once per site (wp_next_scheduled
// short-circuits on every later page load). A site upgrading from the
// older 5-minute schedule already has the hook scheduled under that old
// recurrence, which wp_next_scheduled() alone wouldn't replace — the
// interval on an existing scheduled event is frozen at the time it was
// scheduled, so it has to be explicitly cleared and rescheduled to pick up
// the new, shorter interval.
$nugevonden_scheduled = wp_get_scheduled_event(NUGEVONDEN_SYNC_CRON_HOOK);
if (!$nugevonden_scheduled) {
    wp_schedule_event(time(), 'nugevonden_one_minute', NUGEVONDEN_SYNC_CRON_HOOK);
} elseif ($nugevonden_scheduled->schedule !== 'nugevonden_one_minute') {
    wp_clear_scheduled_hook(NUGEVONDEN_SYNC_CRON_HOOK);
    wp_schedule_event(time(), 'nugevonden_one_minute', NUGEVONDEN_SYNC_CRON_HOOK);
}

add_action('admin_menu', function () {
    add_options_page(
        'Nugevonden Sync',
        'Nugevonden Sync',
        'manage_options',
        'nugevonden-sync',
        'nugevonden_sync_settings_page'
    );
});

function nugevonden_sync_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    if (isset($_POST['nugevonden_regenerate']) && check_admin_referer('nugevonden_sync_settings')) {
        update_option(NUGEVONDEN_SYNC_OPTION, wp_generate_password(40, false));
        echo '<div class="updated"><p>Nieuwe sleutel gegenereerd — vergeet niet ook de sleutel bij Nugevonden bij te werken.</p></div>';
    }
    if (isset($_POST['nugevonden_sync_now']) && check_admin_referer('nugevonden_sync_settings')) {
        nugevonden_sync_run();
        echo '<div class="updated"><p>Synchronisatie uitgevoerd.</p></div>';
    }
    if (isset($_POST['nugevonden_save_author']) && check_admin_referer('nugevonden_sync_settings')) {
        update_option(NUGEVONDEN_SYNC_AUTHOR_OPTION, (int) $_POST['nugevonden_author_id']);
        echo '<div class="updated"><p>Auteur opgeslagen.</p></div>';
    }

    $secret = nugevonden_sync_get_secret();
    $last_image_error = get_option(NUGEVONDEN_SYNC_LAST_IMAGE_ERROR);
    $current_author_id = nugevonden_sync_author_id();
    $wp_users = get_users(['orderby' => 'display_name']);
    ?>
    <div class="wrap">
        <h1>Nugevonden Sync</h1>
        <?php if ($last_image_error): ?>
        <div class="notice notice-warning"><p><strong>Laatste afbeelding-fout:</strong> <?php echo esc_html($last_image_error); ?></p></div>
        <?php endif; ?>
        <p>
            Nieuwe orders komen hier binnen als <strong>concept</strong> (Berichten &rarr; Concepten) — pas zodra je
            'm zelf publiceert, gaat de live link automatisch terug naar Nugevonden (zichtbaar bij zowel de klant
            als in het admin-overzicht).
        </p>
        <p>Plak deze sleutel in Nugevonden bij Admin &rarr; Websites &rarr; deze site &rarr; WordPress-koppeling, bij "WP Sync sleutel":</p>
        <table class="form-table">
            <tr>
                <th>Sleutel</th>
                <td><input type="text" readonly value="<?php echo esc_attr($secret); ?>" style="width:400px" onclick="this.select()"></td>
            </tr>
        </table>
        <form method="post">
            <?php wp_nonce_field('nugevonden_sync_settings'); ?>
            <button type="submit" name="nugevonden_sync_now" value="1" class="button button-primary">Nu synchroniseren</button>
            <button type="submit" name="nugevonden_regenerate" value="1" class="button" onclick="return confirm('Nieuwe sleutel genereren? De oude werkt dan niet meer.');">Genereer nieuwe sleutel</button>
        </form>

        <h2>Auteur</h2>
        <p>Welke WordPress-gebruiker als auteur op een nieuwe post moet komen — anders staat er geen auteur bij.</p>
        <form method="post">
            <?php wp_nonce_field('nugevonden_sync_settings'); ?>
            <select name="nugevonden_author_id">
                <?php foreach ($wp_users as $wp_user): ?>
                <option value="<?php echo esc_attr($wp_user->ID); ?>" <?php selected($current_author_id, $wp_user->ID); ?>>
                    <?php echo esc_html($wp_user->display_name); ?>
                </option>
                <?php endforeach; ?>
            </select>
            <button type="submit" name="nugevonden_save_author" value="1" class="button">Opslaan</button>
        </form>
        <p>
            Deze site haalt elke minuut automatisch nieuwe orders op zolang de site bezoekers krijgt (WordPress'
            eigen cron werkt zo). Voor betrouwbaardere timing &mdash; ook zonder bezoekers &mdash; kun je bij
            SiteGround Site Tools &rarr; Devs &rarr; Cron Jobs een taak instellen die
            <code><?php echo esc_html(site_url('wp-cron.php')); ?></code> elke minuut aanroept.
        </p>
    </div>
    <?php
}
