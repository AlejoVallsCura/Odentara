const test = require("node:test");
const assert = require("node:assert/strict");

// El módulo lee JWT_SECRET en cada firma, así que alcanza con definirlo antes
// de requerirlo.
process.env.JWT_SECRET = process.env.JWT_SECRET || "secreto-de-prueba";

const { signToken, verifyToken } = require("../lib/signed-token");

test("un token recién emitido verifica con los mismos datos", () => {
  const token = signToken({ scope: "serve", parts: [1, 5], ttlSeconds: 60 });
  assert.equal(verifyToken({ scope: "serve", parts: [1, 5], token }), true);
});

test("un token de una clínica no sirve para el mismo id en otra clínica", () => {
  // La razón de firmar clinicId además del id de la imagen: con bases dedicadas
  // el espacio de ids se repite, y la imagen 5 de la clínica 1 es un archivo
  // distinto de la imagen 5 de la clínica 2.
  const token = signToken({ scope: "serve", parts: [1, 5], ttlSeconds: 60 });

  assert.equal(verifyToken({ scope: "serve", parts: [2, 5], token }), false);
});

test("cambiar el id de la imagen invalida el token", () => {
  const token = signToken({ scope: "serve", parts: [1, 5], ttlSeconds: 60 });
  assert.equal(verifyToken({ scope: "serve", parts: [1, 6], token }), false);
});

test("un token de un scope no sirve en otro", () => {
  const token = signToken({ scope: "serve", parts: [1, 5], ttlSeconds: 60 });
  assert.equal(verifyToken({ scope: "export", parts: [1, 5], token }), false);
});

test("un token vencido no verifica", () => {
  const token = signToken({ scope: "serve", parts: [1, 5], ttlSeconds: -1 });
  assert.equal(verifyToken({ scope: "serve", parts: [1, 5], token }), false);
});

test("la expiración no se puede estirar editando la URL", () => {
  // exp viaja en claro dentro del token, pero entra en el HMAC: subirlo a mano
  // rompe la firma en vez de extender la validez.
  const token = signToken({ scope: "serve", parts: [1, 5], ttlSeconds: -1 });
  const firma = token.slice(token.indexOf(".") + 1);
  const futuro = Math.floor(Date.now() / 1000) + 3600;

  assert.equal(verifyToken({ scope: "serve", parts: [1, 5], token: `${futuro}.${firma}` }), false);
});

test("una firma con otro largo devuelve false en vez de tirar excepción", () => {
  // timingSafeEqual exige buffers del mismo tamaño.
  const exp = Math.floor(Date.now() / 1000) + 60;
  assert.equal(verifyToken({ scope: "serve", parts: [1, 5], token: `${exp}.corta` }), false);
});

test("valores no string no rompen la verificación", () => {
  for (const token of [null, undefined, 42, {}, "", "sin-punto"]) {
    assert.equal(verifyToken({ scope: "serve", parts: [1, 5], token }), false);
  }
});
