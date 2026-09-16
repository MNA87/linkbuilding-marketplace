<?php
/**
 * Plugin Name: Nugevonden Publish Bridge
 * Description: Eigen publicatie-endpoint (buiten /wp-json/ om) voor Nugevonden, voor sites waar hosting-beveiliging (bijv. SiteGround AI Anti-Bot Protection) automatische verzoeken naar de WordPress REST API blokkeert.
 * Version: 1.0.0
 * Author: Nugevonden
 */

if (!defined('ABSPATH')) {
    exit;
}

define('NUGEVONDEN_BRIDGE_PATH', '/nugevonden-publish');
define('NUGEVONDEN_BRIDGE_OPTION', 'nugevonden_publish_secret');

function nugevonden_bridge_get_secret() {
    $secret = get_option(NUGEVONDEN_BRIDGE_OPTION);
    if (!$secret) {
        $secret = wp_generate_password(40, false);
        update_option(NUGEVONDEN_BRIDGE_OPTION, $secret);
    }
    return $secret;
}

add_action('init', function () {
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
    $path = rtrim((string) $path, '/');
    if ($path !== NUGEVONDEN_BRIDGE_PATH) {
        return;
    }

    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        status_header(405);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Method not allowed']);
        exit;
    }

    $secret = nugevonden_bridge_get_secret();
    $provided = isset($_SERVER['HTTP_X_NUGEVONDEN_SECRET']) ? (string) $_SERVER['HTTP_X_NUGEVONDEN_SECRET'] : '';
    if ($provided === '' || !hash_equals($secret, $provided)) {
        status_header(403);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'Forbidden']);
        exit;
    }

    $title = isset($_POST['title']) ? sanitize_text_field(wp_unslash($_POST['title'])) : '';
    // Content comes pre-sanitized from Nugevonden's own server before it ever
    // reaches this endpoint (which only Nugevonden's server, authenticated
    // with the secret above, can reach) — not re-filtered through wp_kses
    // here, since WordPress's default post filter strips the inline
    // color/alignment styling Nugevonden's editor already allowed.
    $content = isset($_POST['content']) ? wp_unslash($_POST['content']) : '';

    if ($title === '' || $content === '') {
        status_header(400);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'title en content zijn verplicht']);
        exit;
    }

    $post_id = wp_insert_post([
        'post_title'   => $title,
        'post_content' => $content,
        'post_status'  => 'publish',
        'post_type'    => 'post',
    ], true);

    if (is_wp_error($post_id)) {
        status_header(500);
        header('Content-Type: application/json');
        echo json_encode(['error' => $post_id->get_error_message()]);
        exit;
    }

    if (!empty($_FILES['image']) && ($_FILES['image']['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK) {
        require_once ABSPATH . 'wp-admin/includes/image.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';

        $attachment_id = media_handle_upload('image', $post_id);
        if (!is_wp_error($attachment_id)) {
            set_post_thumbnail($post_id, $attachment_id);
        }
    }

    header('Content-Type: application/json');
    echo json_encode(['url' => get_permalink($post_id)]);
    exit;
});

add_action('admin_menu', function () {
    add_options_page(
        'Nugevonden Publish Bridge',
        'Nugevonden Publish',
        'manage_options',
        'nugevonden-publish-bridge',
        'nugevonden_bridge_settings_page'
    );
});

function nugevonden_bridge_settings_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    if (isset($_POST['nugevonden_regenerate']) && check_admin_referer('nugevonden_bridge_settings')) {
        update_option(NUGEVONDEN_BRIDGE_OPTION, wp_generate_password(40, false));
        echo '<div class="updated"><p>Nieuwe sleutel gegenereerd.</p></div>';
    }

    $secret = nugevonden_bridge_get_secret();
    $endpoint = home_url(NUGEVONDEN_BRIDGE_PATH);
    ?>
    <div class="wrap">
        <h1>Nugevonden Publish Bridge</h1>
        <p>Plak deze twee waarden in Nugevonden bij Admin &rarr; Websites &rarr; deze site &rarr; WordPress-koppeling:</p>
        <table class="form-table">
            <tr>
                <th>Endpoint URL</th>
                <td><input type="text" readonly value="<?php echo esc_attr($endpoint); ?>" style="width:400px" onclick="this.select()"></td>
            </tr>
            <tr>
                <th>Sleutel</th>
                <td><input type="text" readonly value="<?php echo esc_attr($secret); ?>" style="width:400px" onclick="this.select()"></td>
            </tr>
        </table>
        <form method="post">
            <?php wp_nonce_field('nugevonden_bridge_settings'); ?>
            <button type="submit" name="nugevonden_regenerate" value="1" class="button" onclick="return confirm('Weet je zeker dat je een nieuwe sleutel wilt genereren? De oude sleutel werkt dan niet meer.');">Genereer nieuwe sleutel</button>
        </form>
    </div>
    <?php
}
