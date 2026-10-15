# Poner la demo en el VPS

Guía para un VPS con **Ubuntu 22.04 o 24.04**. Hay dos partes independientes:

1. **Panel de seguimiento** (15 minutos): una página web con datos ficticios. No necesita base de datos
   ni claves.
2. **Bot de reporte diario** (opcional, 20 minutos): el bot de Telegram corriendo las 24 h, para que los
   DT lo prueben desde el celular sin depender de una PC prendida.

En esta etapa el panel y el bot todavía no comparten datos: el panel muestra sus obras ficticias y el bot
las suyas. Conectarlos es el próximo paso.

## Antes de empezar

- La IP del VPS y el usuario con el que se entra por SSH (lo da el proveedor).
- Opcional pero recomendado: un subdominio apuntando a la IP del VPS, por ejemplo
  `obras.saezsanchez.com.ar` (un registro **A** en el DNS del dominio). Con dominio, la página sale con
  HTTPS automático. Sin dominio funciona igual, por `http://` y la IP.

Entrar al VPS:

```bash
ssh usuario@IP_DEL_VPS
```

## 1. Preparar el servidor

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git ufw
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw --force enable
```

## 2. Instalar Caddy (servidor web con HTTPS automático)

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

## 3. Bajar el panel

```bash
sudo git clone https://github.com/Leoscd/seguimiento-de-obra-saez-sanchez.git /opt/seguimiento-de-obra
```

## 4. Publicarlo

Crear una contraseña para que la demo no quede abierta a cualquiera que tenga el link:

```bash
caddy hash-password
```

Escribí la contraseña dos veces y copiá el texto que devuelve (empieza con `$2a$`). Después editá la
configuración de Caddy:

```bash
sudo nano /etc/caddy/Caddyfile
```

Borrá lo que tiene y pegá esto. Cambiá `obras.saezsanchez.com.ar` por tu subdominio (o por `:80` si no
tenés dominio), `coordinacion` por el usuario que quieras y `HASH` por el texto que copiaste:

```
obras.saezsanchez.com.ar {
	root * /opt/seguimiento-de-obra/panel
	file_server
	basic_auth {
		coordinacion HASH
	}
}
```

Guardá (Ctrl+O, Enter, Ctrl+X) y aplicá:

```bash
sudo systemctl reload caddy
```

Listo: abrí `https://obras.saezsanchez.com.ar` (o `http://IP_DEL_VPS`), entrá con el usuario y la
contraseña, y aparece el tablero.

Si no carga, mirá el error con `sudo journalctl -u caddy -n 50`. Lo más común: el subdominio todavía no
apunta a la IP (puede tardar hasta una hora) o los puertos 80 y 443 están cerrados en el panel del
proveedor del VPS.

### Actualizar el panel

Cada vez que haya cambios en este repo:

```bash
cd /opt/seguimiento-de-obra && sudo git pull
```

No hace falta reiniciar nada.

## 5. Opcional: el bot de reporte diario las 24 h

El bot usa Telegram en modo *long polling*: no necesita dominio ni HTTPS. Hace falta el token del bot
(se crea en Telegram con @BotFather) y una API key de OpenAI con saldo. El detalle de cómo conseguir
cada uno está en el
[README del bot](https://github.com/Leoscd/bot-saez-sanchez/blob/main/docs/DEMO_TELEGRAM.md).

Instalar en un usuario propio, así el bot no corre como administrador:

```bash
sudo apt install -y python3-venv
sudo useradd --system --create-home --home-dir /opt/bot-obra obrabot
sudo -u obrabot git clone https://github.com/Leoscd/bot-saez-sanchez.git /opt/bot-obra/app
cd /opt/bot-obra/app
sudo -u obrabot python3 -m venv .venv
sudo -u obrabot .venv/bin/pip install -r requirements.txt
sudo -u obrabot cp .env.example .env
sudo -u obrabot nano .env
```

En el `.env` completá como mínimo `TELEGRAM_BOT_TOKEN` y `OPENAI_API_KEY`. Las claves quedan solo en el
servidor: nunca las subas al repositorio ni las pegues en un chat.

Cargar las obras demo:

```bash
sudo -u obrabot .venv/bin/python scripts/seed_demo.py
```

Dejarlo corriendo como servicio (arranca solo si el VPS se reinicia):

```bash
sudo nano /etc/systemd/system/bot-obra.service
```

```
[Unit]
Description=Bot de reporte diario de obra
After=network-online.target
Wants=network-online.target

[Service]
User=obrabot
WorkingDirectory=/opt/bot-obra/app
ExecStart=/opt/bot-obra/app/.venv/bin/python main.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now bot-obra
sudo systemctl status bot-obra
```

Ver qué está haciendo: `sudo journalctl -u bot-obra -f`. Actualizarlo:
`cd /opt/bot-obra/app && sudo -u obrabot git pull && sudo systemctl restart bot-obra`.

Las fechas de las obras demo se calculan desde el día en que se corre el seed. Antes de mostrarlo,
volvé a correr `scripts/seed_demo.py` y reiniciá el servicio.

## Cuidados

- El panel de esta etapa no guarda nada en el servidor: lo que cada uno carga queda en su navegador.
- No cargues datos reales de obras en la demo. Para eso está el sistema real de la próxima etapa, con
  ingreso por cuenta de Google y permisos por rol.
- Este repositorio es público. Las contraseñas y claves van solo en el servidor (Caddyfile y `.env`).
