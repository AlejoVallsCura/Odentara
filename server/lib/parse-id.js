/**
 * parseId — convierte un string de route param a entero positivo.
 * Devuelve null si el valor no es un entero positivo válido.
 *
 * Uso:
 *   const id = parseId(req.params.id);
 *   if (!id) return res.status(400).json({ ok: false, error: "ID inválido." });
 */
function parseId(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

module.exports = { parseId };
