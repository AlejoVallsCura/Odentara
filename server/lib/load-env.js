const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

let loaded = false;

// Busca .env-secrets subiendo por el árbol de directorios desde la carpeta de
// la app. Antes se miraba un solo nivel arriba (domains/<dominio>/nodejs →
// domains/<dominio>), pero el sistema de deploy nuevo de Hostinger corre la app
// desde domains/<dominio>/.builds/versions/<hash>/nodejs — cuatro niveles más
// abajo — y el archivo dejaba de encontrarse en cada deploy, porque además el
// <hash> cambia. Subir buscando lo resuelve para los dos layouts y para
// cualquier otro que aparezca después.
//
// Este archivo es la fuente confiable de secretos: las variables de entorno del
// panel se inyectan solo en el worker inicial, y los workers que la plataforma
// levanta después arrancan sin ellas (verificado: procesos distintos del mismo
// build respondiendo, unos con la key y otros sin ella).
function findExternalSecrets(startDir, maxLevels = 8) {
  let dir = startDir;
  for (let i = 0; i <= maxLevels; i += 1) {
    const candidate = path.join(dir, ".env-secrets");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break; // llegamos a la raíz del filesystem
    }
    dir = parent;
  }
  return null;
}

function loadEnv() {
  if (loaded) {
    return;
  }

  const projectRoot = path.resolve(__dirname, "..", "..");
  const localEnvPath = path.join(projectRoot, ".env.local");
  const defaultEnvPath = path.join(projectRoot, ".env");
  const externalSecretsPath = findExternalSecrets(projectRoot);

  if (fs.existsSync(localEnvPath)) {
    dotenv.config({ path: localEnvPath });
  }

  if (fs.existsSync(defaultEnvPath)) {
    dotenv.config({ path: defaultEnvPath, override: false });
  }

  if (externalSecretsPath) {
    dotenv.config({ path: externalSecretsPath, override: false });
  }

  // Una línea al arrancar diciendo de dónde salieron los secretos. Va solo a
  // los logs del servidor y no imprime ningún valor. Cuando la app corre en
  // varios workers y alguno queda sin variables, este log es lo que permite
  // darse cuenta enseguida en vez de perseguir el síntoma desde afuera.
  console.log(
    externalSecretsPath
      ? `[env] .env-secrets cargado desde ${externalSecretsPath}`
      : "[env] .env-secrets no encontrado — los secretos dependen del entorno del proceso"
  );

  loaded = true;
}

module.exports = {
  loadEnv,
};
