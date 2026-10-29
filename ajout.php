<?php
declare(strict_types=1);

/*
 * Enregistre une personne dans la table `1` de la base `travail`.
 * Colonnes utilisées : nom, prenom, email, tele, adres.
 * Répond en JSON quand la page l'exige (fetch), sinon par une petite page HTML.
 */

const DB_HOST = '127.0.0.1';
const DB_USER = 'root';
const DB_PASS = '';
const DB_NAME = 'travail';

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

function reply(bool $ok, string $message, int $status = 200): void
{
    http_response_code($status);
    $accept = $_SERVER['HTTP_ACCEPT'] ?? '';

    if (str_contains($accept, 'application/json')) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => $ok, 'message' => $message], JSON_UNESCAPED_UNICODE);
        exit;
    }

    header('Content-Type: text/html; charset=utf-8');
    $safe = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
    echo '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<title>SOS planète Terre</title></head><body style="font-family:sans-serif;padding:2rem">'
        . "<p>{$safe}</p><p><a href=\"contact.html\">Retour au formulaire</a></p></body></html>";
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    reply(false, 'Méthode non autorisée.', 405);
}

$nom     = trim((string) ($_POST['nom'] ?? ''));
$prenom  = trim((string) ($_POST['prenom'] ?? ''));
$email   = trim((string) ($_POST['email'] ?? ''));
$tele    = trim((string) ($_POST['tele'] ?? ''));
$adresse = trim((string) ($_POST['adresse'] ?? ''));

if (mb_strlen($nom) < 2 || mb_strlen($prenom) < 2 || mb_strlen($adresse) < 5) {
    reply(false, 'Vérifiez votre nom, votre prénom et votre adresse.', 422);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    reply(false, 'Adresse e-mail invalide.', 422);
}
if (!preg_match('/^[29][0-9]{7}$/', $tele)) {
    reply(false, 'Le numéro doit compter 8 chiffres et commencer par 2 ou 9.', 422);
}

try {
    $conx = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    $conx->set_charset('utf8mb4');

    $check = $conx->prepare('SELECT 1 FROM `1` WHERE `email` = ? LIMIT 1');
    $check->bind_param('s', $email);
    $check->execute();
    $exists = $check->get_result()->num_rows > 0;
    $check->close();

    if ($exists) {
        reply(false, 'Cette adresse e-mail est déjà enregistrée.', 409);
    }

    $insert = $conx->prepare('INSERT INTO `1` (`nom`, `prenom`, `email`, `tele`, `adres`) VALUES (?, ?, ?, ?, ?)');
    $insert->bind_param('sssss', $nom, $prenom, $email, $tele, $adresse);
    $insert->execute();
    $insert->close();
    $conx->close();

    reply(true, 'Merci, vous faites maintenant partie de la communauté.');
} catch (mysqli_sql_exception $e) {
    // Le détail reste dans les journaux du serveur, jamais dans la réponse.
    error_log('ajout.php : ' . $e->getMessage());
    reply(false, 'Une erreur est survenue, réessayez plus tard.', 500);
}
