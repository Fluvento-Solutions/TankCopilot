/**
 * Consumption Service - Verbrauchsberechnung
 * 
 * Berechnet den realen Durchschnittsverbrauch auf Basis aller Tankvorgänge.
 * 
 * Algorithmus:
 * 1. Alle Tankvorgänge nach odometerKm (oder Datum) sortieren
 * 2. Segmente zwischen aufeinanderfolgenden Tankungen berechnen:
 *    - kmDelta = current.odometerKm - previous.odometerKm
 *    - segmentConsumption = (current.liters / kmDelta) * 100
 * 3. Zeitfenster: letzte 60 Tage (mindestens 28 Tage)
 * 4. km-gewichteter Durchschnitt: (Σ segmentConsumption * kmDelta) / Σ kmDelta
 * 
 * Beispiel:
 * - Tankung 1: 1000 km, 50 L
 * - Tankung 2: 1500 km, 45 L
 * - Segment: 500 km, 45 L → Verbrauch = (45/500)*100 = 9.0 L/100km
 * 
 * - Tankung 3: 2000 km, 48 L
 * - Segment: 500 km, 48 L → Verbrauch = (48/500)*100 = 9.6 L/100km
 * 
 * Gewichteter Durchschnitt: (9.0*500 + 9.6*500) / 1000 = 9.3 L/100km
 */

/**
 * Berechnet den Durchschnittsverbrauch für ein Fahrzeug im letzten Quartal (90 Tage)
 * @param {string} vehicleId - ID des Fahrzeugs
 * @param {Array} refuels - Array aller Tankvorgänge des Fahrzeugs
 * @param {number} days - Anzahl Tage für Berechnung (Standard: 90 für Quartal)
 * @returns {number|null} - Durchschnittsverbrauch in L/100km oder null wenn nicht berechenbar
 */
export function calculateConsumption(vehicleId, refuels, days = 60) {
  if (!refuels || refuels.length < 2) {
    return null
  }

  // Sortiere nach odometerKm (aufsteigend), bei Gleichstand nach Datum
  const sortedRefuels = [...refuels].sort((a, b) => {
    if (a.odometerKm !== b.odometerKm) {
      return a.odometerKm - b.odometerKm
    }
    return new Date(a.date) - new Date(b.date)
  })

  // Berechne Segmente
  const segments = []
  const now = new Date()
  const daysAgo = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
  const twentyEightDaysAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000)

  for (let i = 1; i < sortedRefuels.length; i++) {
    const current = sortedRefuels[i]
    const previous = sortedRefuels[i - 1]

    const kmDelta = current.odometerKm - previous.odometerKm

    // Ignoriere ungültige Segmente (kmDelta <= 0 oder negative Liter)
    if (kmDelta <= 0 || current.liters <= 0) {
      continue
    }

    // Berechne Verbrauch für dieses Segment
    const segmentConsumption = (current.liters / kmDelta) * 100

    // Prüfe Zeitfenster: Segment ist gültig, wenn current.date innerhalb des Fensters liegt
    const currentDate = new Date(current.date)
    
    segments.push({
      date: current.date,
      kmDelta,
      segmentConsumption,
      liters: current.liters
    })
  }

  if (segments.length === 0) {
    return null
  }

  // Filtere nach Zeitfenster: letzte X Tage
  let filteredSegments = segments.filter(seg => {
    const segDate = new Date(seg.date)
    return segDate >= daysAgo
  })

  // Falls zu wenige Segmente in 60 Tagen, erweitere auf 28 Tage
  if (filteredSegments.length < 2) {
    filteredSegments = segments.filter(seg => {
      const segDate = new Date(seg.date)
      return segDate >= twentyEightDaysAgo
    })
  }

  // Falls immer noch zu wenige, verwende alle Segmente (weniger verlässlich)
  if (filteredSegments.length < 2) {
    filteredSegments = segments
    // Hinweis: Der Wert ist weniger verlässlich, da ältere Daten verwendet werden
  }

  // Berechne km-gewichteten Durchschnitt
  let totalWeightedConsumption = 0
  let totalKm = 0

  filteredSegments.forEach(seg => {
    totalWeightedConsumption += seg.segmentConsumption * seg.kmDelta
    totalKm += seg.kmDelta
  })

  if (totalKm === 0) {
    return null
  }

  const avgConsumption = totalWeightedConsumption / totalKm

  // Runde auf 2 Dezimalstellen
  return Math.round(avgConsumption * 100) / 100
}

/**
 * Berechnet den Verbrauch für ein Quartal (90 Tage)
 * @param {string} vehicleId - ID des Fahrzeugs
 * @param {Array} refuels - Array aller Tankvorgänge des Fahrzeugs
 * @returns {number|null} - Durchschnittsverbrauch in L/100km oder null wenn nicht berechenbar
 */
export function calculateQuarterlyConsumption(vehicleId, refuels) {
  return calculateConsumption(vehicleId, refuels, 90)
}

/**
 * Aktualisiert den Durchschnittsverbrauch eines Fahrzeugs
 * @param {Object} vehicle - Fahrzeug-Objekt
 * @param {Array} refuels - Array aller Tankvorgänge
 * @returns {Object} - Fahrzeug mit aktualisiertem avgConsumptionLPer100km
 * 
 * Hinweis: avgConsumptionLPer100km wird nur gesetzt, wenn genug Daten vorhanden sind.
 * Der geschätzte Verbrauch (estimatedConsumptionLPer100km) bleibt erhalten, wenn keine echten Daten vorhanden sind.
 */
export function updateVehicleConsumption(vehicle, refuels) {
  if (!vehicle || !vehicle.id) {
    return vehicle
  }

  const vehicleRefuels = refuels.filter(r => r.vehicleId === vehicle.id)
  const avgConsumption = calculateConsumption(vehicle.id, vehicleRefuels)

  // Nur aktualisieren, wenn ein berechneter Verbrauch vorhanden ist
  // Der geschätzte Verbrauch bleibt erhalten, wenn keine echten Daten vorhanden sind
  return {
    ...vehicle,
    avgConsumptionLPer100km: avgConsumption || vehicle.avgConsumptionLPer100km || null
  }
}

