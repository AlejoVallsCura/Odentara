# Backup y restauración

Cierra el punto 2 de la secuencia de despliegue de `PLAN-CODEX.md`: *"Backup de
base y de R2; probar restauración"*.

Son dos mitades del mismo dato. `ClinicalImage` guarda en la base la clave del
objeto; el archivo vive en R2. Restaurar una sola mitad deja las fichas con
imágenes rotas, así que las dos se corren juntas y en el mismo momento.

## Los scripts

| Script | Qué hace |
|---|---|
| `npm run backup:db` | Dump de la base a `.sql.gz` + manifiesto con el conteo de filas por tabla |
| `npm run backup:r2` | Copia incremental del bucket R2 a disco (por ETag: la segunda corrida solo baja lo que cambió) |
| `npm run backup:verify -- <archivo.sql.gz>` | Restaura el dump en una base descartable y compara contra el manifiesto |
| `npm run backup:restore -- <archivo.sql.gz>` | Restaura el dump sobre una base real, con confirmacion escrita y respaldo previo |

El manifiesto es lo que hace que esto sea un backup y no un archivo grande de
origen desconocido. Los modos de falla que importan son silenciosos en el
momento del dump — mysqldump cortado por timeout, tablas sin permiso de lectura,
gzip truncado — y ninguno se ve hasta que se intenta restaurar. Por eso el paso
de verificación no es opcional.

## Antes de cada deploy

```bash
npm run backup:db
npm run backup:r2
npm run backup:verify -- backups/db/odentara-db-<marca>.sql.gz
```

`backup:verify` necesita `VERIFY_DATABASE_URL` apuntando a una base
**descartable** — se borra y se recrea en cada corrida:

```bash
VERIFY_DATABASE_URL="mysql://root:@localhost:3306/odentara_verify" npm run backup:verify -- backups/db/odentara-db-<marca>.sql.gz
```

El script rechaza cualquier nombre de base que no termine en `_verify`,
`_restore` o `_test`. Es una barrera tosca a propósito.

## En el server de Hostinger

Dos cosas que no son obvias y hacen fallar el primer intento:

**Las variables de entorno no están.** La app las recibe inyectadas por
Passenger; un script suelto por SSH no. `DATABASE_URL` hay que exportarla a
mano. Los secretos de R2 sí se encuentran solos, porque `load-env` sube por el
árbol buscando `.env-secrets` — pero solo si el script se corre **desde dentro
de la carpeta de la app**, no desde el home.

**Node no está en el PATH.** Hay que usar la ruta completa (verificar la versión
con `ls /opt/alt/ | grep nodejs`):

```bash
cd ~/domains/odentara.com/nodejs
DATABASE_URL="mysql://usuario:pass@localhost:3306/base" BACKUP_DIR=~/backups /opt/alt/alt-nodejs20/root/usr/bin/node scripts/backup-db.js
```

`BACKUP_DIR=~/backups` apunta **fuera** de la carpeta de la app a propósito: el
deploy extrae el zip con "Overwrite" sobre `~/domains/odentara.com/nodejs/`, y
cualquier cosa que viva ahí adentro queda expuesta a que un deploy la pise o a
que el server web la sirva. Un `.sql.gz` con datos de pacientes accesible por
URL sería un incidente de datos, no un bug.

Después del backup, bajarlo a la máquina local con `scp` o por el Administrador
de Archivos, y verificarlo ahí — la verificación necesita crear y borrar bases,
que en hosting compartido normalmente no se puede.

## Desde el panel de plataforma

Además de los comandos, hay una sección **Backups** en el panel de plataforma
(solo para el administrador de plataforma):

- **Crear backup ahora** — un botón. Sirve para el caso "voy a tocar algo a las
  21, hago una copia a las 20".
- **Backup automático** — diario, de lunes a viernes, o semanal, a la hora que
  se elija. El horario se evalúa en **hora de Argentina**, no en la del servidor.
- **Retención** — conserva los últimos N y borra el resto. Sin esto un backup
  diario llena el disco en un mes.
- **Historial** con estado, filas, tamaño y descarga.

La descarga va en dos pasos: se pide un permiso que dura 5 minutos y recién ahí
el navegador baja el archivo. Es necesario porque una descarga por navegación no
lleva el header de autorización, y conviene que el enlace no siga sirviendo si
queda en el historial.

### Por qué el botón no verifica

La verificación necesita crear y borrar una base, y el usuario de MySQL en
hosting compartido no puede. Así que el panel te da un dump con su manifiesto,
pero **comprobar que restaura sigue siendo manual**, en tu máquina, con
`npm run backup:verify`. El botón dice "backup creado", no "estás a salvo".

### Varios workers, un solo backup

La plataforma levanta varios procesos del mismo build y el programador corre en
todos. La coordinación es la restricción de unicidad de `BackupRun.slot`: todos
calculan la misma cadena para el mismo turno, el primero que la inserta gana y
los demás se retiran sin hacer nada. Probado con tres procesos simultáneos: uno
ejecuta, dos se retiran, y sin errores en el log.

## Volver a un backup

Hay una falla y querés dejar la base como estaba el 24 a las 3 de la mañana.

La regla que ordena todo lo demás: **no se pisa la base que la app está usando.**
Se restaura en una base nueva, al lado, y recién cuando se confirmó que quedó
bien se apunta la app ahí. Así, si la restauración sale mal o el backup no era
el que uno pensaba, volver atrás es cambiar una línea de texto en vez de un
segundo incidente arriba del primero.

### 0. Primero, copiar el estado roto

Aunque esté roto. Entre el backup y la falla se cargaron turnos, pacientes y
cobros reales, y esa es la única copia que existe de ellos. Se hace desde el
panel de plataforma con **Crear backup ahora**, o por SSH con `backup-db.js`.

Si usás `restore-db.js`, esto lo hace solo antes de tocar nada, y lo guarda en
`<BACKUP_DIR>/pre-restore/`, fuera de la rotación automática — no lo borra la
retención.

### 1. Crear la base de destino

En hPanel → **Bases de datos MySQL** → crear una nueva, por ejemplo
`u284214165_rescate`, y darle acceso al **mismo usuario** que ya usa la app. El
script no crea bases: en hosting compartido el panel lleva su propia
contabilidad de cuáles existen, y crearlas por abajo con SQL se le desordena.

### 2. Restaurar

Por SSH, desde la carpeta de la app (la misma donde corrés `backup-db.js`):

```bash
RESTORE_DATABASE_URL="mysql://usuario:clave@127.0.0.1:3306/u284214165_rescate" \
  /opt/alt/alt-nodejs20/root/usr/bin/node scripts/restore-db.js \
  ~/backups/db/odentara-db-2026-08-24_03-00-11.sql.gz
```

El script muestra qué backup es, qué base va a pisar y cuántas filas se pierden,
y **pide que escribas el nombre de la base** para seguir. Cualquier otra cosa
cancela sin tocar nada.

Al terminar compara lo restaurado contra el manifiesto. Si no coincide, lo dice
y corta: la base quedó en un estado que no es ni el de antes ni el del backup, y
apuntar la app ahí sería lo peor de los dos mundos.

### 3. Apuntar la app a la base restaurada

En `.env-secrets`, cambiar `DATABASE_URL` para que termine en
`/u284214165_rescate`, y **reiniciar Passenger** desde el panel de Hostinger.
Sin el reinicio siguen vivos los workers viejos con las conexiones a la base
anterior.

Entrar a la app y mirar que estén los datos del backup.

**Si algo salió mal**, volver es cambiar `DATABASE_URL` a la base original y
reiniciar de nuevo. La base vieja sigue intacta: nunca se tocó.

### El caso de apuro: pisar la base actual

Si no hay lugar para otra base, o el problema es justamente que la base actual
tiene datos que hay que borrar ya:

```bash
/opt/alt/alt-nodejs20/root/usr/bin/node scripts/restore-db.js <archivo.sql.gz> --sobre-produccion
```

Hace un dump del estado actual en `<BACKUP_DIR>/pre-restore/` antes de empezar,
pide la confirmación escrita igual, y borra las tablas una por una — nunca
`DROP DATABASE`, para no desincronizar el panel de Hostinger.

Mientras dura la importación la app está sirviendo sobre una base a medio
llenar. Conviene detener el proceso desde hPanel antes y volver a levantarlo
después.

### Si el backup es anterior a una migración

El dump trae el esquema del día que se hizo; el código desplegado es el de hoy.
Volver al backup del 21 con el código del 24 deja la app pidiendo tablas que en
ese dump todavía no existían.

Tanto `restore-db.js` como `backup:verify` lo detectan y lo dicen con nombre y
apellido:

```
OJO: es anterior al esquema actual. Le faltan 2 tablas que el código de hoy
usa: BackupSchedule, BackupRun.
```

La salida es aplicar, sobre la base restaurada, el SQL de las migraciones
posteriores a la fecha del backup (`prisma/migrations/`, de la más vieja a la
más nueva) antes de apuntar la app.

### Lo que no vuelve atrás

- **Las imágenes clínicas.** Viven en R2, no en la base. Restaurar la base al 24
  no borra las imágenes subidas el 25; quedan como archivos huérfanos, sin ficha
  que los referencie. Al revés es peor: si una imagen se borró de R2 después del
  24, la ficha restaurada apunta a un archivo que ya no está.
- **Todo lo cargado entre el backup y la falla.** Está en el dump de
  `pre-restore/`, que es de donde hay que sacarlo a mano si hace falta.
- **El nombre y los colores de la clínica**, que hoy viven solo en el navegador
  (`localStorage`) y no en la base.

## Qué NO cubre esto

- **El backup automático no avisa si falla.** Queda registrado como "error" en
  el historial del panel, pero nadie recibe un mail. Hay que mirarlo.
- **No hay copia fuera del server.** Un backup que vive en la misma máquina que
  la base no protege contra perder la máquina.
- **R2 no tiene versionado.** Si un objeto se sobrescribe o se borra, la copia
  local lo tiene hasta la próxima corrida — que lo va a seguir teniendo, porque
  el script nunca borra local, solo baja. Pero tampoco detecta el borrado.

`backups/` está en `.gitignore` y excluido del zip de deploy. Contiene datos de
pacientes: no va al repo ni al server.
