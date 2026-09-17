<?php
/**
 * Plugin Name: Nugevonden WP Sync
 * Description: Haalt betaalde Nugevonden-orders zelf op en publiceert ze als blogpost — de site vraagt Nugevonden actief (pull), in plaats van dat Nugevonden naar de site stuurt (push). Nodig wanneer hosting-beveiliging (bijv. SiteGround AI Anti-Bot Protection) binnenkomende automatische verzoeken blokkeert, ongeacht het pad — uitgaande verzoeken die de site zelf initieert (zoals dit) raakt die beveiliging niet.
 * Version: 1.0.0
 * Author: Nugevonden
 */

if (!defined('ABSPATH')) {
    exit;
}

define('NUGEVONDEN_SYNC_OPTION', 'nugevonden_sync_secret');
define('NUGEVONDEN_SYNC_API_BASE', 'https://mijn.nugevonden.nl');
define('NUGEVONDEN_SYNC_CRON_HOOK', 'nugevonden_sync_event');

function nugevonden_sync_get_secret() {
    $secret = get_option(NUGEVONDEN_SYNC_OPTION);
    if (!$secret) {
        $secret = wp_generate_password(40, false);
        update_option(NUGEVONDEN_SYNC_OPTION, $secret);
    }
    return $secret;
}

function nugevonden_sync_run() {
    $secret = nugevonden_sync_get_secret();
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
        $post_args = [
            'post_title'   => sanitize_text_field($item['title']),
            'post_content' => $item['content'],
            'post_status'  => 'publish',
            'post_type'    => 'post',
        ];
        if (!empty($item['categoryId'])) {
            $post_args['post_category'] = [(int) $item['categoryId']];
        }

        $post_id = wp_insert_post($post_args, true);

        if (is_wp_error($post_id)) {
            continue;
        }

        // Post + image happen in one pass, then a single confirmation —
        // wrapped in try/catch so that if the image step hits something
        // fatal (memory limit, a plugin conflict during
        // media_sideload_image), it can't stop execution before the
        // confirmation below still goes out.
        if (!empty($item['imageUrl'])) {
            try {
                require_once ABSPATH . 'wp-admin/includes/image.php';
                require_once ABSPATH . 'wp-admin/includes/file.php';
                require_once ABSPATH . 'wp-admin/includes/media.php';

                $attachment_id = media_sideload_image(esc_url_raw($item['imageUrl']), $post_id, null, 'id');
                if (!is_wp_error($attachment_id)) {
                    set_post_thumbnail($post_id, $attachment_id);
                }
            } catch (\Throwable $e) {
                error_log('Nugevonden sync: afbeelding toevoegen mislukt voor post ' . $post_id . ': ' . $e->getMessage());
            }
        }

        wp_remote_post(NUGEVONDEN_SYNC_API_BASE . '/api/wp-sync/ack', [
            'timeout' => 20,
            'headers' => ['Content-Type' => 'application/json'],
            'body'    => json_encode([
                'secret'      => $secret,
                'orderItemId' => $item['id'],
                'liveUrl'     => get_permalink($post_id),
            ]),
        ]);
    }
}

// Automatic: WordPress's own cron checks every 5 minutes (fires on site
// traffic; for reliable timing regardless of visits, set up a real server
// cron on SiteGround Site Tools -> Devs -> Cron Jobs that hits wp-cron.php
// every 5 minutes — standard WordPress practice).
add_filter('cron_schedules', function ($schedules) {
    $schedules['nugevonden_five_minutes'] = ['interval' => 300, 'display' => 'Elke 5 minuten (Nugevonden)'];
    return $schedules;
});

add_action(NUGEVONDEN_SYNC_CRON_HOOK, 'nugevonden_sync_run');

// Must-use plugins never fire activation hooks, so schedule directly if the
// event isn't registered yet — this runs once per site (wp_next_scheduled
// short-circuits on every later page load).
if (!wp_next_scheduled(NUGEVONDEN_SYNC_CRON_HOOK)) {
    wp_schedule_event(time(), 'nugevonden_five_minutes', NUGEVONDEN_SYNC_CRON_HOOK);
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

    $secret = nugevonden_sync_get_secret();
    ?>
    <div class="wrap">
        <h1>Nugevonden Sync</h1>
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
        <p>
            Deze site haalt elke 5 minuten automatisch nieuwe orders op zolang de site bezoekers krijgt (WordPress'
            eigen cron werkt zo). Voor betrouwbaardere timing kun je bij SiteGround Site Tools &rarr; Devs &rarr;
            Cron Jobs een taak instellen die <code><?php echo esc_html(site_url('wp-cron.php')); ?></code> elke
            5 minuten aanroept.
        </p>
    </div>
    <?php
}
