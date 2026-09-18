<?php
/**
 * Plugin Name: Nugevonden WP Sync
 * Description: Haalt betaalde Nugevonden-orders zelf op en zet ze als concept-blogpost in WordPress — de site vraagt Nugevonden actief (pull), in plaats van dat Nugevonden naar de site stuurt (push). Nodig wanneer hosting-beveiliging (bijv. SiteGround AI Anti-Bot Protection) binnenkomende automatische verzoeken blokkeert, ongeacht het pad — uitgaande verzoeken die de site zelf initieert (zoals dit) raakt die beveiliging niet. Meldt ook de categorieën van deze site, zodat een klant er bij het bestellen zelf een kan kiezen zonder dat iemand ze handmatig moet invoeren. Zodra het concept hier gepubliceerd wordt, gaat de live link automatisch terug naar Nugevonden.
 * Version: 1.8.7
 * Author: Nugevonden
 */

if (!defined('ABSPATH')) {
    exit;
}

define('NUGEVONDEN_SYNC_VERSION', '1.8.7');
define('NUGEVONDEN_SYNC_SLUG', 'nugevonden-wp-sync');
define('NUGEVONDEN_SYNC_UPDATE_CACHE', 'nugevonden_sync_update_info');
define('NUGEVONDEN_SYNC_LAST_UPDATE_CHECK', 'nugevonden_sync_last_update_check');
define('NUGEVONDEN_SYNC_OPTION', 'nugevonden_sync_secret');
define('NUGEVONDEN_SYNC_API_BASE', 'https://mijn.nugevonden.nl');
define('NUGEVONDEN_SYNC_CRON_HOOK', 'nugevonden_sync_event');
define('NUGEVONDEN_SYNC_LAST_IMAGE_ERROR', 'nugevonden_sync_last_image_error');
define('NUGEVONDEN_SYNC_AUTHOR_OPTION', 'nugevonden_sync_author_id');
define('NUGEVONDEN_SYNC_STARTPAGINA_URL_OPTION', 'nugevonden_sync_startpagina_url');
define('NUGEVONDEN_SYNC_TARGET_URL_META', '_nugevonden_target_url');
define('NUGEVONDEN_SYNC_LINK_TAXONOMY', 'nugevonden_link_categorie');
define('NUGEVONDEN_SYNC_LINK_POST_TYPE', 'nugevonden_link');

// A homepage-link is its own kind of thing, not a blog post — it gets its
// own post type with its own menu item, so it never ends up mixed in
// among real blog articles in Berichten as the list grows. Not "public":
// nobody ever visits one directly, [nugevonden_startpagina] is what
// actually renders them.
add_action('init', function () {
    register_post_type(NUGEVONDEN_SYNC_LINK_POST_TYPE, [
        'label'        => 'Homepage-links',
        'public'       => false,
        'show_ui'      => true,
        'show_in_menu' => true,
        'menu_icon'    => 'dashicons-admin-links',
        'supports'     => ['title'],
        'has_archive'  => false,
        'rewrite'      => false,
    ]);

    // A homepage-link's rubriek (e.g. "SEO", "Interieur") is deliberately a
    // separate list from the blog's own Categorieën — it describes a
    // startpagina section, not a blog topic, and mixing the two would mean
    // a customer ordering a homepage-link has to pick from (and pollute)
    // the blog's own category list. Attached to the post type above, so it
    // gets its own "Homepage-link rubrieken" admin screen under that menu.
    register_taxonomy(NUGEVONDEN_SYNC_LINK_TAXONOMY, NUGEVONDEN_SYNC_LINK_POST_TYPE, [
        'label'        => 'Homepage-link rubrieken',
        'hierarchical' => true,
        'show_ui'      => true,
        'show_in_menu' => true,
        'show_admin_column' => true,
        'query_var'    => true,
        'rewrite'      => false,
    ]);
});

// wp_insert_post() falls back to get_current_user_id() for post_author
// when it isn't set explicitly — during an automatic sync (WP-Cron, no
// logged-in visitor) that's 0, so the post ends up with no author at all.
// Uses the admin-picked author (settings page below) when set, otherwise
// the first administrator account found.
// WordPress' own update check only ever asks wordpress.org, and this
// plugin isn't published there — so it asks Nugevonden itself whether a
// newer version exists. From this point on, a new plugin version shows up
// as the normal "Update available" banner in the Plugins list, with the
// usual one-click "Update now" — no more downloading and re-uploading a
// .php file by hand. Cached for 12 hours so it doesn't add a request to
// every admin page load — except when the admin explicitly clicks
// "Controleer opnieuw" on Dashboard > Updates (the same ?force-check=1
// WordPress' own core update check reads), which should always mean a
// fresh check, not "the same cached answer for up to 12 more hours".
// Records what actually happened on the last attempt (or that no attempt
// has happened at all yet) — shown on the settings page below. Debugging
// this blind (only from Nugevonden's side, which can only ever see
// requests that actually arrived) turned out to be unreliable: this makes
// it visible directly on the site itself instead.
function nugevonden_sync_record_update_check($result) {
    update_option(NUGEVONDEN_SYNC_LAST_UPDATE_CHECK, [
        'at'     => current_time('mysql'),
        'result' => $result,
    ]);
}

function nugevonden_sync_fetch_update_info() {
    $force_check = isset($_GET['force-check']);
    if (!$force_check) {
        $cached = get_site_transient(NUGEVONDEN_SYNC_UPDATE_CACHE);
        if ($cached !== false) {
            nugevonden_sync_record_update_check('gecached antwoord gebruikt (versie ' . $cached['version'] . ')');
            return $cached;
        }
    }

    $response = wp_remote_get(NUGEVONDEN_SYNC_API_BASE . '/api/wp-sync/plugin/version', ['timeout' => 15]);
    if (is_wp_error($response)) {
        nugevonden_sync_record_update_check('verzoek mislukte: ' . $response->get_error_message());
        return null;
    }
    $status = wp_remote_retrieve_response_code($response);
    if ($status !== 200) {
        nugevonden_sync_record_update_check('kreeg status ' . $status . ' terug');
        return null;
    }

    $info = json_decode(wp_remote_retrieve_body($response), true);
    if (!is_array($info) || empty($info['version'])) {
        nugevonden_sync_record_update_check('kreeg een onverwacht antwoord terug');
        return null;
    }

    set_site_transient(NUGEVONDEN_SYNC_UPDATE_CACHE, $info, 12 * HOUR_IN_SECONDS);
    nugevonden_sync_record_update_check('gelukt, laatste versie bij Nugevonden: ' . $info['version']);
    return $info;
}

// WordPress' own wp_update_plugins() has its own built-in optimization:
// if no installed plugin's version number has changed since the last
// check, it skips the whole check — including this plugin's filter below
// — even when the admin explicitly clicks "Controleer opnieuw". Since
// THIS plugin's version only ever changes at Nugevonden, not locally,
// that "nothing changed" is permanently true from WordPress' point of
// view, so it would never re-check on its own. Deleting WordPress' own
// update_plugins transient right before it looks at it forces a real,
// fresh check every time the admin opens the Updates or Plugins screen.
add_action('load-update-core.php', function () {
    delete_site_transient('update_plugins');
});
add_action('load-plugins.php', function () {
    delete_site_transient('update_plugins');
});

add_filter('pre_set_site_transient_update_plugins', function ($transient) {
    $info = nugevonden_sync_fetch_update_info();
    if (!$info) {
        return $transient;
    }

    $plugin_file = plugin_basename(__FILE__);
    if (version_compare($info['version'], NUGEVONDEN_SYNC_VERSION, '>')) {
        $transient->response[$plugin_file] = (object) [
            'slug'        => NUGEVONDEN_SYNC_SLUG,
            'plugin'      => $plugin_file,
            'new_version' => $info['version'],
            'url'         => NUGEVONDEN_SYNC_API_BASE,
            'package'     => $info['download_url'],
            'tested'      => isset($info['tested']) ? $info['tested'] : '',
        ];
    } else {
        unset($transient->response[$plugin_file]);
    }
    return $transient;
});

// Powers the "Bekijk versiedetails" popup WordPress shows from the Plugins
// list next to "Update available" — without this it would 404, since this
// plugin has no page on wordpress.org to show instead.
add_filter('plugins_api', function ($result, $action, $args) {
    if ($action !== 'plugin_information' || empty($args->slug) || $args->slug !== NUGEVONDEN_SYNC_SLUG) {
        return $result;
    }
    $info = nugevonden_sync_fetch_update_info();
    if (!$info) {
        return $result;
    }
    return (object) [
        'name'          => isset($info['name']) ? $info['name'] : 'Nugevonden WP Sync',
        'slug'          => NUGEVONDEN_SYNC_SLUG,
        'version'       => $info['version'],
        'author'        => 'Nugevonden',
        'requires'      => isset($info['requires']) ? $info['requires'] : '',
        'tested'        => isset($info['tested']) ? $info['tested'] : '',
        'sections'      => isset($info['sections']) ? $info['sections'] : ['description' => ''],
        'download_link' => $info['download_url'],
    ];
}, 10, 3);

// The "Update available" banner would otherwise keep showing the old
// version for up to 12 hours after an update — clear the cache the moment
// WordPress finishes swapping the file in, so it disappears right away.
add_action('upgrader_process_complete', function ($upgrader, $hook_extra) {
    if (!empty($hook_extra['plugins']) && in_array(plugin_basename(__FILE__), $hook_extra['plugins'], true)) {
        delete_site_transient(NUGEVONDEN_SYNC_UPDATE_CACHE);
    }
}, 10, 2);

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
// Blog categories and homepage-link rubrieken (see NUGEVONDEN_SYNC_LINK_TAXONOMY
// above) are reported as two separate lists — they're kept apart end to end.
function nugevonden_sync_categories() {
    $secret = nugevonden_sync_get_secret();

    $wp_categories = get_categories(['hide_empty' => false]);
    $categories = array_map(function ($cat) {
        return ['id' => $cat->term_id, 'name' => $cat->name];
    }, $wp_categories);

    $wp_link_categories = get_terms(['taxonomy' => NUGEVONDEN_SYNC_LINK_TAXONOMY, 'hide_empty' => false]);
    $link_categories = is_wp_error($wp_link_categories) ? [] : array_map(function ($term) {
        return ['id' => $term->term_id, 'name' => $term->name];
    }, $wp_link_categories);

    $response = wp_remote_post(NUGEVONDEN_SYNC_API_BASE . '/api/wp-sync/categories', [
        'timeout' => 20,
        'headers' => ['Content-Type' => 'application/json'],
        'body'    => json_encode(['secret' => $secret, 'categories' => $categories, 'linkCategories' => $link_categories]),
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

// A homepage-link item (the startpagina feature) isn't an article to
// review — just a category, anchor text and a target URL — so unlike
// nugevonden_sync_run()'s blog posts below, it's created already
// published and acked with the real, final URL right away. No draft
// step, no waiting on transition_post_status.
function nugevonden_sync_homepage_link($item, $secret) {
    if (empty($item['anchorText']) || empty($item['targetUrl'])) {
        return;
    }

    $post_args = [
        'post_title'   => sanitize_text_field($item['anchorText']),
        'post_content' => '',
        'post_status'  => 'publish',
        'post_type'    => NUGEVONDEN_SYNC_LINK_POST_TYPE,
    ];
    $author_id = nugevonden_sync_author_id();
    if ($author_id) {
        $post_args['post_author'] = $author_id;
    }

    $post_id = wp_insert_post($post_args, true);
    if (is_wp_error($post_id)) {
        return;
    }

    // A separate taxonomy from the blog's own Categorieën — never
    // post_category, which would file this under the blog's category list
    // instead of the startpagina's own rubrieken.
    if (!empty($item['categoryId'])) {
        wp_set_object_terms($post_id, (int) $item['categoryId'], NUGEVONDEN_SYNC_LINK_TAXONOMY);
    }

    update_post_meta($post_id, NUGEVONDEN_SYNC_TARGET_URL_META, esc_url_raw($item['targetUrl']));

    // The customer's "live link" is the startpagina page itself (where
    // their listing now visibly appears), not this post's own permalink —
    // nobody ever navigates to the post directly, [nugevonden_startpagina]
    // is what actually renders it. Falls back to the permalink only if the
    // admin hasn't set a startpagina URL yet, so there's still something.
    $startpagina_url = get_option(NUGEVONDEN_SYNC_STARTPAGINA_URL_OPTION);
    $live_url = $startpagina_url ? $startpagina_url : get_permalink($post_id);

    wp_remote_post(NUGEVONDEN_SYNC_API_BASE . '/api/wp-sync/ack', [
        'timeout' => 20,
        'headers' => ['Content-Type' => 'application/json'],
        'body'    => json_encode([
            'secret'      => $secret,
            'orderItemId' => $item['id'],
            'liveUrl'     => $live_url,
        ]),
    ]);
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
        if (empty($item['id'])) {
            continue;
        }

        if (isset($item['type']) && $item['type'] === 'homepage_link') {
            nugevonden_sync_homepage_link($item, $secret);
            continue;
        }

        if (empty($item['title']) || empty($item['content'])) {
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

// Renders every homepage-link post (see nugevonden_sync_homepage_link()),
// grouped by category — the actual "startpagina" visitors see. Place
// [nugevonden_startpagina] on whichever page should show it, and fill in
// that page's URL in the plugin settings so that's what gets reported back
// to Nugevonden as the "live link".
add_shortcode('nugevonden_startpagina', function () {
    $posts = get_posts([
        'post_type'      => NUGEVONDEN_SYNC_LINK_POST_TYPE,
        'post_status'    => 'publish',
        'posts_per_page' => -1,
        'meta_key'       => NUGEVONDEN_SYNC_TARGET_URL_META,
    ]);
    if (empty($posts)) {
        return '<p>Nog geen links geplaatst.</p>';
    }

    $by_category = [];
    foreach ($posts as $post) {
        $target_url = get_post_meta($post->ID, NUGEVONDEN_SYNC_TARGET_URL_META, true);
        if (!$target_url) {
            continue;
        }
        $terms = get_the_terms($post->ID, NUGEVONDEN_SYNC_LINK_TAXONOMY);
        $category_name = (!empty($terms) && !is_wp_error($terms)) ? $terms[0]->name : 'Overig';
        $by_category[$category_name][] = ['title' => get_the_title($post), 'url' => $target_url];
    }
    ksort($by_category);

    ob_start();
    // Inline and scoped (nugevonden- prefix on every class) on purpose —
    // works the same regardless of which theme is active, no separate
    // stylesheet to enqueue. Grid with auto-fit/minmax already reflows on
    // its own as the screen narrows; the media query on top is just a
    // stricter guarantee of a single column on small phones.
    echo '<style>
        .nugevonden-startpagina { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 260px)); gap: 20px; }
        .nugevonden-startpagina-category { background: #f4f8f6; border: 1px solid #e2e6e1; border-radius: 12px; overflow: hidden; box-sizing: border-box; }
        .nugevonden-startpagina-category h3 { margin: 0; padding: 12px 18px; font-size: 13px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #fff; background: #1d4d3f; }
        .nugevonden-startpagina-category ul { margin: 0; padding: 16px 18px; list-style: none; display: flex; flex-direction: column; gap: 10px; }
        .nugevonden-startpagina-category a { color: #1d4d3f; text-decoration: none; }
        .nugevonden-startpagina-category a:hover { text-decoration: underline; }
        @media (max-width: 480px) {
            .nugevonden-startpagina { grid-template-columns: 1fr; }
        }
    </style>';
    echo '<div class="nugevonden-startpagina">';
    foreach ($by_category as $category_name => $links) {
        echo '<div class="nugevonden-startpagina-category">';
        echo '<h3>' . esc_html($category_name) . '</h3>';
        echo '<ul>';
        foreach ($links as $link) {
            echo '<li><a href="' . esc_url($link['url']) . '" target="_blank" rel="noopener">' . esc_html($link['title']) . '</a></li>';
        }
        echo '</ul>';
        echo '</div>';
    }
    echo '</div>';
    return ob_get_clean();
});

// One-click setup for the "Startpagina (homepage-links)" section below —
// creates a page with the shortcode already on it (reuses one if it's
// already there instead of making a second) and immediately saves its
// URL as the startpagina-URL setting, so there's nothing left to copy or
// paste by hand.
function nugevonden_sync_create_startpagina_page() {
    $existing = get_posts([
        'post_type'      => 'page',
        'posts_per_page' => 1,
        's'              => '[nugevonden_startpagina]',
    ]);
    if (!empty($existing)) {
        return get_permalink($existing[0]->ID);
    }

    $page_id = wp_insert_post([
        'post_title'   => 'Links',
        'post_content' => '[nugevonden_startpagina]',
        'post_status'  => 'publish',
        'post_type'    => 'page',
    ], true);
    if (is_wp_error($page_id)) {
        return null;
    }
    return get_permalink($page_id);
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
    if (isset($_POST['nugevonden_save_startpagina_url']) && check_admin_referer('nugevonden_sync_settings')) {
        update_option(NUGEVONDEN_SYNC_STARTPAGINA_URL_OPTION, sanitize_text_field($_POST['nugevonden_startpagina_url']));
        echo '<div class="updated"><p>Startpagina-URL opgeslagen.</p></div>';
    }
    if (isset($_POST['nugevonden_create_startpagina']) && check_admin_referer('nugevonden_sync_settings')) {
        $created_url = nugevonden_sync_create_startpagina_page();
        if ($created_url) {
            update_option(NUGEVONDEN_SYNC_STARTPAGINA_URL_OPTION, $created_url);
            echo '<div class="updated"><p>Pagina "Links" aangemaakt en ingesteld: <a href="' . esc_url($created_url) . '" target="_blank">' . esc_html($created_url) . '</a></p></div>';
        } else {
            echo '<div class="notice notice-error"><p>Aanmaken van de pagina is mislukt. Probeer het opnieuw of maak de pagina zelf aan met het shortcode <code>[nugevonden_startpagina]</code>.</p></div>';
        }
    }

    $secret = nugevonden_sync_get_secret();
    $last_image_error = get_option(NUGEVONDEN_SYNC_LAST_IMAGE_ERROR);
    $current_author_id = nugevonden_sync_author_id();
    $wp_users = get_users(['orderby' => 'display_name']);
    $startpagina_url = get_option(NUGEVONDEN_SYNC_STARTPAGINA_URL_OPTION);
    ?>
    <div class="wrap">
        <h1>Nugevonden Sync</h1>
        <p class="description">
            Versie <?php echo esc_html(NUGEVONDEN_SYNC_VERSION); ?>. Nieuwe versies verschijnen vanaf nu automatisch
            als "Update beschikbaar" bij je Plugins &mdash; niet meer handmatig een bestand uploaden. Zie je 'm niet
            meteen staan, ga dan naar Dashboard &rarr; Updates en klik op "Controleer opnieuw" &mdash; dat forceert
            een verse check in plaats van te wachten tot de volgende automatische.
        </p>
        <?php $last_update_check = get_option(NUGEVONDEN_SYNC_LAST_UPDATE_CHECK); ?>
        <p class="description">
            Laatste update-check:
            <?php if ($last_update_check): ?>
                <?php echo esc_html($last_update_check['at']); ?> &mdash; <?php echo esc_html($last_update_check['result']); ?>
            <?php else: ?>
                nog nooit uitgevoerd sinds deze versie is geïnstalleerd.
            <?php endif; ?>
        </p>
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

        <h2>Startpagina (homepage-links)</h2>
        <p>
            Een "homepage-link" order (categorie + ankertekst + URL, geen artikel) komt hier direct binnen als
            een eigen "Homepage-link" item (zie het gelijknamige menu hiernaast — <em>niet</em> tussen je
            Berichten), meteen live, zonder concept-stap. Ze worden getoond op de pagina waar het shortcode
            <code>[nugevonden_startpagina]</code> op staat, gegroepeerd per categorie.
        </p>
        <?php if (!$startpagina_url): ?>
        <form method="post">
            <?php wp_nonce_field('nugevonden_sync_settings'); ?>
            <button type="submit" name="nugevonden_create_startpagina" value="1" class="button button-primary">Maak startpagina automatisch aan</button>
            <p class="description">Maakt een pagina "Links" met het shortcode er al op, en stelt de URL hieronder meteen in — niets zelf te plakken of te maken.</p>
        </form>
        <?php endif; ?>
        <p>Of stel het handmatig in, bijvoorbeeld als je liever een bestaande pagina gebruikt:</p>
        <form method="post">
            <?php wp_nonce_field('nugevonden_sync_settings'); ?>
            <input type="url" name="nugevonden_startpagina_url" value="<?php echo esc_attr($startpagina_url); ?>" placeholder="<?php echo esc_attr(site_url('/links')); ?>" style="width:400px">
            <button type="submit" name="nugevonden_save_startpagina_url" value="1" class="button">Opslaan</button>
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
