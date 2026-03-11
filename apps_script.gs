// ============================================================
//  Google Apps Script — Backend pour l'app Dépenses Couple
//  Déployez en tant que Web App :
//    - Exécuter en tant que : Moi
//    - Qui a accès        : Toute personne
// ============================================================

const SHEET_NAME = 'Saisie';

// ─── ÉTAPE 1 : Exécute cette fonction UNE SEULE FOIS ────────
function setup() {
  // Définit le token secret
  PropertiesService.getScriptProperties().setProperty('SECRET', 'votre-token-secret-ici');

  // Crée la feuille Saisie si elle n'existe pas
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    const headers = ['Date','Payeur','Catégorie','Carte (€)','Espèces (€)',
                     'Tickets resto (€)','Total (€)','Année','Mois n°',
                     'Mois','Description','Notes','ID','Solo'];
    sheet.appendRow(headers);
    sheet.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#1E88E5').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  Logger.log('✅ Setup terminé — token défini, feuille Saisie prête.');
}

// ─── ÉTAPE 2 : Teste que le script fonctionne ───────────────
function testScript() {
  const secret = PropertiesService.getScriptProperties().getProperty('SECRET');
  Logger.log('Token actuel : ' + secret);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (sheet) {
    Logger.log('✅ Feuille Saisie trouvée — ' + sheet.getLastRow() + ' ligne(s)');
  } else {
    Logger.log('❌ Feuille Saisie introuvable — relance setup()');
  }
}

// ─── GET : récupérer toutes les transactions ─────────────────
function doGet(e) {
  // Gérer le preflight CORS (OPTIONS)
  const output = _buildResponse(handleGet(e));
  return output;
}

function handleGet(e) {
  try {
    const secret = PropertiesService.getScriptProperties().getProperty('SECRET');
    if (!e || !e.parameter || e.parameter.secret !== secret) {
      return { error: 'Token invalide' };
    }
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) return { error: 'Feuille introuvable — relance setup()' };
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return { rows: [] };

    const rows = data.slice(1).filter(r => r[0] !== '').map(r => ({
      date: r[0] instanceof Date
        ? Utilities.formatDate(r[0], Session.getScriptTimeZone(), 'yyyy-MM-dd')
        : String(r[0]),
      payeur:    String(r[1]),
      categorie: String(r[2]),
      carte:     Number(r[3]) || 0,
      especes:   Number(r[4]) || 0,
      tickets:   Number(r[5]) || 0,
      total:     Number(r[6]) || 0,
      annee:     Number(r[7]) || 0,
      mois_num:  Number(r[8]) || 0,
      mois:      String(r[9]),
      desc:      String(r[10]),
      notes:     String(r[11]),
      id:        String(r[12]),
      solo:      r[13] === true || r[13] === 'true',
      synced:    true
    }));
    return { rows };
  } catch(err) {
    return { error: err.toString() };
  }
}

// ─── POST : ajouter une transaction ──────────────────────────
function doPost(e) {
  const output = _buildResponse(handlePost(e));
  return output;
}

function handlePost(e) {
  try {
    const secret = PropertiesService.getScriptProperties().getProperty('SECRET');
    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch(err) {
      return { error: 'JSON invalide' };
    }
    if (payload.secret !== secret) return { error: 'Token invalide' };

    if (payload.action === 'add') {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
      if (!sheet) return { error: 'Feuille introuvable' };
      sheet.appendRow([
        payload.date,
        payload.payeur,
        payload.categorie,
        payload.carte   || payload.cb || 0,
        payload.especes || payload.ca || 0,
        payload.tickets || payload.tr || 0,
        payload.total   || 0,
        payload.annee   || new Date(payload.date).getFullYear(),
        payload.mois_num,
        payload.mois,
        payload.desc    || payload.libelle || '',
        payload.notes   || '',
        payload.id,
        payload.solo    || false
      ]);
      SpreadsheetApp.flush();
      return { success: true };
    }

    if (payload.action === 'delete') {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
      const data = sheet.getDataRange().getValues();
      for (let i = data.length - 1; i >= 1; i--) {
        if (String(data[i][12]) === String(payload.id)) {
          sheet.deleteRow(i + 1);
          SpreadsheetApp.flush();
          return { success: true };
        }
      }
      return { error: 'Transaction introuvable' };
    }

    return { error: 'Action inconnue : ' + payload.action };
  } catch(err) {
    return { error: err.toString() };
  }
}

// ─── Helper : construit la réponse avec en-têtes CORS ────────
function _buildResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}