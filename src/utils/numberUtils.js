/**
 * Number Utilities - Dezimaltrennzeichen-Normalisierung
 * 
 * Konvertiert Komma zu Punkt für interne Berechnungen
 */

/**
 * Konvertiert einen String mit Komma oder Punkt als Dezimaltrennzeichen zu einer Number
 * @param {string|number} value - Wert zum Konvertieren
 * @returns {number} - Konvertierte Zahl oder NaN
 */
export function parseDecimal(value) {
  if (typeof value === 'number') {
    return value
  }
  
  if (typeof value !== 'string') {
    return NaN
  }

  // Entferne Leerzeichen
  value = value.trim()

  // Ersetze Komma durch Punkt
  value = value.replace(',', '.')

  // Parse zu Number
  return parseFloat(value)
}

/**
 * Normalisiert einen String-Wert für Input-Felder (Komma zu Punkt)
 * @param {string} value - Eingabewert
 * @returns {string} - Normalisierter Wert
 */
export function normalizeDecimalInput(value) {
  if (typeof value !== 'string') {
    return value
  }

  // Ersetze Komma durch Punkt
  return value.replace(',', '.')
}

/**
 * Formatiert eine Zahl für die Anzeige (Punkt als Dezimaltrennzeichen)
 * @param {number} value - Zahl zum Formatieren
 * @param {number} decimals - Anzahl Dezimalstellen (Standard: 2)
 * @returns {string} - Formatierte Zahl
 */
export function formatDecimal(value, decimals = 2) {
  if (typeof value !== 'number' || isNaN(value)) {
    return ''
  }
  
  return value.toFixed(decimals)
}

