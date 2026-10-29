import type { DbOrder } from '../types';

/**
 * Opción unificada para el selector desplegable (`<select>`) de vendedores.
 */
export interface VendedorOption {
  /** Valor canónico seleccionado en el `<select>` (versión más completa del nombre). */
  value: string;
  /** Etiqueta visible en mayúsculas con ortografía/diacríticos enriquecidos. */
  label: string;
  /** Cantidad de variantes crudas agrupadas bajo este vendedor. */
  variantsCount: number;
}

/**
 * Partículas conectoras del español que pueden omitirse en variantes manuales
 * (ej. "DANIEL DEL GALLEGO" vs "DANIEL GALLEGO").
 */
const CONNECTOR_PARTICLES = new Set(['de', 'del', 'la', 'las', 'los']);

/**
 * Etiquetas geográficas o sufijos operativos cortos que suelen concatenarse con "-" o "/"
 * en la columna `ruta` de Supabase (ej. "OSCAR ORTIZ- CORO", "J PABLO ARAUJO - CAB/OJE"),
 * y que no deben tratarse por sí solos como nombres de vendedor cuando acompañan a una persona.
 */
const ZONE_OR_CHANNEL_SUFFIX_TOKENS = new Set([
  'coro',
  'costa',
  'cab',
  'oje',
  'cabimas',
  'ojeda',
  'norte',
  'sur',
  'este',
  'oeste',
  'senior',
  'maracaibo',
  'mara',
]);

/**
 * Expresión regular para detectar rutas institucionales puras (no nombres propios).
 */
const INSTITUTIONAL_ROUTE_REGEX = /^(?:food\s+service|cuentas\s+clave[sz]?|oficina\b)/i;

/**
 * Expresión regular para limpiar el sufijo de canal "FOOD SERVICE [NORTE|SUR|SENIOR]"
 * (incluyendo variantes con error de tipeo común como "FOOOD SERFVICE")
 * cuando va pegado al final del nombre de un vendedor sin guion
 * (ej. "DANIEL DEL GALLEGO FOOD SERVICE SUR" -> "DANIEL DEL GALLEGO").
 */
const TRAILING_FOOD_SERVICE_REGEX =
  /\s+fo+d\s+ser[fv]+ice(?:\s+(?:norte|sur|e?seni[nñ]?or))?$/i;

/**
 * Pre-normaliza artefactos de captura manual en la columna `ruta`:
 * - Remueve el prefijo accidental "PEDIDO " al inicio del vendedor (ej. "PEDIDO PEDRO ABREU").
 * - Une el guion interno en "CUENTAS CLAVE(S/Z) - 1" / "CUENTAS CLAVE(S/Z) - 2" para que el número
 *   de cuenta clave jamás se separe de "CUENTAS CLAVE" al dividir segmentos compuestos.
 */
function sanitizeRawRutaArtifacts(raw: string): string {
  return raw
    .trim()
    .replace(/^pedido\s+/i, '')
    .replace(/\bcuentas\s+clave[sz]?\s*-\s*(\d+)\b/gi, 'CUENTAS CLAVE $1')
    .replace(/\bcuentas\s+clave[sz]?\b/gi, 'CUENTAS CLAVE')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 1. Función de Normalización (`normalizeNombre`):
 * - Convierte a minúsculas.
 * - Elimina tildes/diacríticos mediante descomposición Unicode NFD.
 * - Elimina signos de puntuación reemplazándolos por espacio para no pegar palabras.
 * - Colapsa espacios múltiples y divide el resultado en un array de tokens válidos.
 */
export function normalizeNombre(nombre: string | null | undefined): string[] {
  if (!nombre) return [];

  const cleaned = String(nombre)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return [];
  return cleaned.split(' ').filter(Boolean);
}

/**
 * Filtra partículas conectoras ("de", "del", "la", "las", "los") preservando
 * todos los tokens sustantivos/numéricos del nombre.
 */
function stripConnectorParticles(tokens: string[]): string[] {
  if (tokens.length <= 1) return tokens;
  const filtered = tokens.filter((t) => !CONNECTOR_PARTICLES.has(t));
  return filtered.length > 0 ? filtered : tokens;
}

/**
 * Determina si un token normalizado es una inicial alfabética de 1 sola letra (a-z).
 * Excluye dígitos ("1", "2") para no mezclar rutas numeradas como "CUENTAS CLAVE 1" y "CUENTAS CLAVE 2".
 */
function isSingleLetterInitial(token: string): boolean {
  return token.length === 1 && /^[a-z]$/.test(token);
}

/**
 * Compara dos tokens normalizados permitiendo igualdad exacta o, si `allowInitial` es `true`,
 * coincidencia de inicial de 1 letra contra el inicio de una palabra completa (ej. "g" <-> "gregorio").
 */
function tokensMatch(tokenA: string, tokenB: string, allowInitial: boolean): boolean {
  if (tokenA === tokenB) return true;
  if (!allowInitial) return false;
  if (isSingleLetterInitial(tokenA) && tokenB.length > 1) {
    return tokenB.startsWith(tokenA);
  }
  if (isSingleLetterInitial(tokenB) && tokenA.length > 1) {
    return tokenA.startsWith(tokenB);
  }
  return false;
}

/**
 * Verifica si TODOS los tokens del conjunto más corto (`shorter`) están contenidos
 * 1-a-1 dentro del conjunto más largo (`longer`), evitando que dos tokens del conjunto
 * corto consuman la misma palabra del conjunto largo.
 */
function isBidirectionalTokenSubset(tokensA: string[], tokensB: string[]): boolean {
  if (tokensA.length === 0 || tokensB.length === 0) return false;

  // Prevención explícita de colisión entre vendedores distintos con el mismo primer nombre:
  // Si ambos conjuntos tienen 2 o más palabras (ej. nombre + apellido) y comparten el primer token,
  // sus palabras restantes (apellidos / segundo nombre) no pueden ser totalmente disjuntas.
  if (tokensA.length >= 2 && tokensB.length >= 2) {
    const sharesFirstGivenName = tokensMatch(tokensA[0], tokensB[0], true);
    if (sharesFirstGivenName) {
      const restA = tokensA.slice(1);
      const restB = tokensB.slice(1);
      const hasSharedSurnameOrMiddle = restA.some((ta) =>
        restB.some((tb) => tokensMatch(ta, tb, true)),
      );
      if (!hasSharedSurnameOrMiddle) {
        return false;
      }
    }
  }

  const [shorter, longer] =
    tokensA.length <= tokensB.length ? [tokensA, tokensB] : [tokensB, tokensA];

  const usedLongerIndices = new Set<number>();
  const unmatchedShorterIndices: number[] = [];
  let exactFullWordMatches = 0;

  // Paso 1: Emparejar primero coincidencias exactas palabra por palabra.
  for (let i = 0; i < shorter.length; i++) {
    const sTok = shorter[i];
    let foundExactIdx = -1;
    for (let j = 0; j < longer.length; j++) {
      if (!usedLongerIndices.has(j) && sTok === longer[j]) {
        foundExactIdx = j;
        break;
      }
    }
    if (foundExactIdx !== -1) {
      usedLongerIndices.add(foundExactIdx);
      if (sTok.length > 1) {
        exactFullWordMatches++;
      }
    } else {
      unmatchedShorterIndices.push(i);
    }
  }

  if (unmatchedShorterIndices.length === 0) {
    return true;
  }

  // Paso 2: Permitir emparejamiento por inicial de 1 letra (ej. "Jose G. Gonzalez" <-> "Jose Gregorio Gonzalez",
  // "J Pablo Araujo" <-> "Juan Pablo Araujo") solo cuando hay al menos 2 tokens y al menos 1 palabra completa exacta.
  if (shorter.length < 2 || exactFullWordMatches < 1) {
    return false;
  }

  for (const sIdx of unmatchedShorterIndices) {
    const sTok = shorter[sIdx];
    let foundInitialIdx = -1;
    for (let j = 0; j < longer.length; j++) {
      if (!usedLongerIndices.has(j) && tokensMatch(sTok, longer[j], true)) {
        foundInitialIdx = j;
        break;
      }
    }
    if (foundInitialIdx === -1) {
      return false;
    }
    usedLongerIndices.add(foundInitialIdx);
  }

  return true;
}

/**
 * Extrae las representaciones de tokens evaluables de un string almacenado en la columna `ruta`.
 * Soporta tanto nombres puros ("Juan Carlos Pérez Gómez") como valores compuestos con canal o zona
 * ("JAIDER MEDINA - FOOD SERVICE NORTE", "OSCAR ORTIZ- CORO", "CUENTAS CLAVE 2 - SAIRU VALLES",
 * "J PABLO ARAUJO - CAB/OJE", "DANIEL DEL GALLEGO FOOD SERVICE SUR").
 */
function extractComparableTokenSets(rawValue: string): string[][] {
  const trimmed = sanitizeRawRutaArtifacts(rawValue);
  if (!trimmed) return [];

  const results: string[][] = [];
  const seenKeys = new Set<string>();

  const pushTokens = (candidateStr: string) => {
    const core = stripConnectorParticles(normalizeNombre(candidateStr));
    if (core.length === 0) return;
    const key = core.join(' ');
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      results.push(core);
    }
  };

  // 1) Siempre incluir los tokens del string completo.
  pushTokens(trimmed);

  // 2) Si tiene sufijo "FOOD SERVICE..." sin guion después de un nombre propio (2+ palabras antes),
  // extraer también la porción pura del nombre del vendedor.
  if (!INSTITUTIONAL_ROUTE_REGEX.test(trimmed) && TRAILING_FOOD_SERVICE_REGEX.test(trimmed)) {
    const withoutFoodService = trimmed.replace(TRAILING_FOOD_SERVICE_REGEX, '').trim();
    if (normalizeNombre(withoutFoodService).length >= 2) {
      pushTokens(withoutFoodService);
    }
  }

  // 3) Si contiene separadores compuestos ("/", " - ", "- "), evaluar sub-segmentos válidos
  // que no sean simples etiquetas geográficas sueltas ("CORO", "LA COSTA", "CAB", "OJE") ni rutas "OFICINA - ...".
  if (/[\/\-]/.test(trimmed) && !/^oficina\s*-/i.test(trimmed)) {
    const rawSegments = trimmed
      .split(/\s*(?:\/|-\s+|\s+-|-)\s*/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (rawSegments.length > 1) {
      for (const seg of rawSegments) {
        const segTokens = stripConnectorParticles(normalizeNombre(seg));
        if (segTokens.length === 0) continue;

        // Ignorar fragmentos que son únicamente abreviaturas de zona ("CORO", "CAB", "OJE", "NORTE", "SUR")
        // o la etiqueta genérica "FOOD SERVICE" sin región cuando acompaña al nombre de un vendedor.
        const isPureZoneNoise = segTokens.every((t) => ZONE_OR_CHANNEL_SUFFIX_TOKENS.has(t));
        if (isPureZoneNoise) continue;
        if (segTokens.join(' ') === 'food service') continue;

        // Si el segmento también termina en "FOOD SERVICE...", limpiar la parte personal.
        if (!INSTITUTIONAL_ROUTE_REGEX.test(seg) && TRAILING_FOOD_SERVICE_REGEX.test(seg)) {
          const cleanPersonSeg = seg.replace(TRAILING_FOOD_SERVICE_REGEX, '').trim();
          if (normalizeNombre(cleanPersonSeg).length >= 2) {
            pushTokens(cleanPersonSeg);
            continue;
          }
        }

        pushTokens(seg);
      }
    }
  }

  return results;
}

/**
 * 2. Función de Coincidencia Inteligente Bidireccional (`matchVendedor`):
 *
 * Devuelve `true` si `nombreEnColumnaSupabase` (columna `ruta` de `public.orders`)
 * y `vendedorSeleccionadoDropdown` corresponden al mismo vendedor en cualquiera de estas combinaciones:
 *   a) Dos nombres y dos apellidos (ej. "Juan Carlos Pérez Gómez").
 *   b) Un solo nombre y un solo apellido, seguidos o salteados ("Juan Pérez", "Juan Gómez", "Carlos Pérez", "Carlos Gómez").
 *   c) Solo el nombre ("Juan" o "Carlos").
 *   d) Solo el apellido ("Pérez" o "Gómez").
 *
 * Incluye prevención de colisión para vendedores distintos que comparten nombre de pila
 * pero tienen apellidos disjuntos (ej. "Carlos Fuenmayor" vs "Carlos Machado", "Juan Pérez" vs "Juan Gómez").
 */
export function matchVendedor(
  nombreEnColumnaSupabase: string | null | undefined,
  vendedorSeleccionadoDropdown: string | null | undefined,
): boolean {
  if (!nombreEnColumnaSupabase || !vendedorSeleccionadoDropdown) return false;

  const setsPedido = extractComparableTokenSets(String(nombreEnColumnaSupabase));
  const setsSeleccionado = extractComparableTokenSets(String(vendedorSeleccionadoDropdown));

  if (setsPedido.length === 0 || setsSeleccionado.length === 0) return false;

  for (const tokensPedido of setsPedido) {
    for (const tokensSeleccionado of setsSeleccionado) {
      if (isBidirectionalTokenSubset(tokensPedido, tokensSeleccionado)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Extrae uno o más nombres limpios candidatos para poblar el `<select>` a partir de un valor crudo de `ruta`,
 * removiendo sufijos operativos/zonales ("- FOOD SERVICE NORTE", "- CORO", "- CAB/OJE") para que la etiqueta
 * del selector muestre limpiamente el nombre del vendedor o la ruta institucional.
 */
function extractCleanDisplayCandidates(rawRuta: string): string[] {
  const collapsed = sanitizeRawRutaArtifacts(rawRuta);
  if (!collapsed || collapsed === '-' || /^\d+$/.test(collapsed)) return [];

  // Preservar rutas institucionales compuestas como "OFICINA - GERENCIA" u "OFICINA - EMPLEADOS"
  if (/^oficina\s*-/i.test(collapsed)) {
    return [collapsed.replace(/\s*-\s*/, ' - ').toUpperCase()];
  }

  // Normalizar etiquetas institucionales "CUENTAS CLAVE 1 [MCH]" / "CUENTAS CLAVE 2 [SV]"
  if (/^cuentas\s+clave\s+(\d+)\b/i.test(collapsed) && !/[\/\-]/.test(collapsed)) {
    const m = collapsed.match(/^cuentas\s+clave\s+(\d+)\b/i);
    if (m) return [`CUENTAS CLAVE ${m[1]}`];
  }

  // Si contiene separadores "-" o "/", separar persona de canal/zona
  if (/[\/\-]/.test(collapsed)) {
    const parts = collapsed
      .split(/\s*(?:\/|-\s+|\s+-|-)\s*/)
      .map((p) => p.trim())
      .filter(Boolean);

    if (parts.length > 1) {
      const cleanParts: string[] = [];
      for (const part of parts) {
        const norm = stripConnectorParticles(normalizeNombre(part));
        if (norm.length === 0 || norm.every((t) => /^\d+$/.test(t))) continue;
        if (norm.every((t) => ZONE_OR_CHANNEL_SUFFIX_TOKENS.has(t))) continue;

        // Ignorar etiqueta genérica "FOOD SERVICE..." cuando acompaña al nombre de un vendedor
        // (ej. "JAIDER MEDINA - FOOD SERVICE NORTE" -> solo candidato personal "JAIDER MEDINA")
        if (/^food\s+service\b/i.test(part) && parts.some((p) => !INSTITUTIONAL_ROUTE_REGEX.test(p))) {
          continue;
        }
        // Ignorar etiqueta "CUENTAS CLAVE..." en el string compuesto si ya acompaña al nombre de la vendedora
        if (/^cuentas\s+clave\b/i.test(part) && parts.some((p) => !INSTITUTIONAL_ROUTE_REGEX.test(p))) {
          continue;
        }

        const cleanedPart = !INSTITUTIONAL_ROUTE_REGEX.test(part)
          ? part.replace(TRAILING_FOOD_SERVICE_REGEX, '').trim()
          : part;
        if (cleanedPart) cleanParts.push(cleanedPart);
      }

      if (cleanParts.length > 0) return cleanParts;
    }
  }

  // Limpiar sufijo "FOOD SERVICE..." cuando viene sin guion tras un nombre propio
  if (!INSTITUTIONAL_ROUTE_REGEX.test(collapsed) && TRAILING_FOOD_SERVICE_REGEX.test(collapsed)) {
    const withoutFs = collapsed.replace(TRAILING_FOOD_SERVICE_REGEX, '').trim();
    if (normalizeNombre(withoutFs).length >= 2) {
      return [withoutFs];
    }
  }

  return [collapsed];
}

/**
 * Calcula un puntaje de completitud para priorizar la versión más completa del nombre
 * (ej. "JUAN CARLOS PÉREZ GÓMEZ" sobre "Juan Pérez" o "J. Pérez").
 */
function scoreCandidateCompleteness(candidate: string): number {
  const allTokens = normalizeNombre(candidate);
  const coreTokens = stripConnectorParticles(allTokens);
  const fullWordCount = coreTokens.filter((t) => t.length > 1).length;
  const hasDiacritics = /[áéíóúüñÁÉÍÓÚÜÑ]/.test(candidate) ? 1 : 0;

  return coreTokens.length * 1000 + fullWordCount * 100 + hasDiacritics * 10 + candidate.length;
}

/**
 * Reconstruye la etiqueta en MAYÚSCULAS del nombre canónico enriqueciendo cada palabra
 * con su mejor variante con tilde o Ñ observada dentro del mismo clúster
 * (ej. "MARIA BRICENO SALA" + "MARIA BRICEÑO" -> "MARIA BRICEÑO SALA").
 */
function buildEnrichedUppercaseLabel(
  canonicalRaw: string,
  accentedTokenMap: Map<string, string>,
): string {
  if (/^oficina\s*-/i.test(canonicalRaw)) {
    return canonicalRaw.replace(/\s*-\s*/, ' - ').replace(/\s+/g, ' ').trim().toUpperCase();
  }

  const rawWords = canonicalRaw
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

  const enrichedWords = rawWords.map((word) => {
    const cleanUpper = word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}.]+$/gu, '').toUpperCase();
    const normTokens = normalizeNombre(cleanUpper);
    if (normTokens.length === 1) {
      const norm = normTokens[0];
      const bestAccented = accentedTokenMap.get(norm);
      if (bestAccented) {
        return bestAccented;
      }
    }
    return cleanUpper || word.toUpperCase();
  });

  return enrichedWords.join(' ');
}

/**
 * Registra palabras con tildes o Ñ en un diccionario `tokenNormalizado -> TOKEN_CON_TILDE`
 * para conservar la ortografía correcta en la etiqueta final del selector.
 */
function collectAccentedTokens(rawName: string, targetMap: Map<string, string>): void {
  const words = rawName
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  for (const word of words) {
    const upper = word.toUpperCase();
    const normArr = normalizeNombre(upper);
    if (normArr.length !== 1) continue;
    const norm = normArr[0];
    const existing = targetMap.get(norm);
    const hasDiacritic = /[ÁÉÍÓÚÜÑ]/.test(upper);
    if (!existing || (hasDiacritic && !/[ÁÉÍÓÚÜÑ]/.test(existing))) {
      targetMap.set(norm, upper);
    }
  }
}

/**
 * 3. Limpieza y Agrupación Dinámica de Opciones del Selector Desplegable (`buildGroupedVendedorOptions`):
 *
 * Combina los vendedores configurados en el catálogo base (`catalogVendedores`) con todos los valores
 * reales de `order.ruta` / `order.vendedor` cargados desde Supabase, agrupando todas las variantes
 * de la misma persona bajo una única opción con la versión más completa de su nombre en mayúsculas.
 */
export function buildGroupedVendedorOptions(
  orders: DbOrder[],
  catalogVendedores: string[] = [],
): VendedorOption[] {
  const uniqueRawCandidates = new Map<string, string>();

  const registerRaw = (raw: string | null | undefined) => {
    if (!raw) return;
    for (const cleanCandidate of extractCleanDisplayCandidates(String(raw))) {
      const upperKey = cleanCandidate.toUpperCase();
      if (!uniqueRawCandidates.has(upperKey)) {
        uniqueRawCandidates.set(upperKey, cleanCandidate);
      }
    }
  };

  for (const catName of catalogVendedores) {
    registerRaw(catName);
  }

  for (const dbOrder of orders) {
    const ord = dbOrder?.order;
    if (!ord) continue;
    registerRaw(ord.ruta || ord.vendedor);
  }

  // Ordenar de mayor a menor completitud para que los nombres completos (3-4 palabras)
  // funden primero los clústeres canónicos y absorban variantes cortas sin crear puentes transitivos.
  const sortedCandidates = Array.from(uniqueRawCandidates.values()).sort(
    (a, b) => scoreCandidateCompleteness(b) - scoreCandidateCompleteness(a),
  );

  interface VendedorCluster {
    canonicalRaw: string;
    canonicalCoreTokens: string[];
    accentedTokens: Map<string, string>;
    variantsCount: number;
  }

  const clusters: VendedorCluster[] = [];

  for (const candidate of sortedCandidates) {
    const candidateCoreTokens = stripConnectorParticles(normalizeNombre(candidate));
    if (candidateCoreTokens.length === 0) continue;

    // Si es un candidato de 1 sola palabra (ej. "MARIANA", "HERNAN", "CARLOS", "GERENCIA"),
    // verificar si ya queda cubierto por algún vendedor canónico existente de 2+ palabras.
    if (candidateCoreTokens.length === 1) {
      const matchingMultiWordClusters = clusters.filter((c) =>
        matchVendedor(candidate, c.canonicalRaw),
      );
      if (matchingMultiWordClusters.length > 0) {
        // Absorber la variante de 1 palabra sin fusionar entre sí a homónimos distintos (ej. varios "CARLOS ...").
        for (const c of matchingMultiWordClusters) {
          collectAccentedTokens(candidate, c.accentedTokens);
          c.variantsCount += 1;
        }
        continue;
      }
    }

    // Para candidatos de 2+ palabras (o 1 palabra sin ningún clúster padre), buscar coincidencia unívoca.
    const matchedCluster = clusters.find((c) => matchVendedor(candidate, c.canonicalRaw));

    if (matchedCluster) {
      collectAccentedTokens(candidate, matchedCluster.accentedTokens);
      matchedCluster.variantsCount += 1;
      if (
        scoreCandidateCompleteness(candidate) >
        scoreCandidateCompleteness(matchedCluster.canonicalRaw)
      ) {
        matchedCluster.canonicalRaw = candidate;
        matchedCluster.canonicalCoreTokens = candidateCoreTokens;
      }
    } else {
      const accentedTokens = new Map<string, string>();
      collectAccentedTokens(candidate, accentedTokens);
      clusters.push({
        canonicalRaw: candidate,
        canonicalCoreTokens: candidateCoreTokens,
        accentedTokens,
        variantsCount: 1,
      });
    }
  }

  return clusters
    .map((cluster) => {
      const label = buildEnrichedUppercaseLabel(cluster.canonicalRaw, cluster.accentedTokens);
      return {
        value: label,
        label,
        variantsCount: cluster.variantsCount,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

/**
 * Resuelve las zonas puntuales configuradas en `VENDEDORES` para el vendedor seleccionado
 * usando `matchVendedor`, garantizando compatibilidad total cuando la opción del `<select>`
 * exhibe el nombre completo canónico (ej. "JUAN PABLO ARAUJO" -> zonas de "Pablo Araujo").
 */
export function getZonasForVendedor(
  vendedorSeleccionado: string | null | undefined,
  vendedoresZonasMap: Record<string, string[]>,
): string[] {
  if (!vendedorSeleccionado) return [];

  const zonasSet = new Set<string>();
  for (const [key, zonas] of Object.entries(vendedoresZonasMap)) {
    if (Array.isArray(zonas) && zonas.length > 0 && matchVendedor(key, vendedorSeleccionado)) {
      for (const z of zonas) {
        zonasSet.add(z);
      }
    }
  }

  return Array.from(zonasSet);
}
