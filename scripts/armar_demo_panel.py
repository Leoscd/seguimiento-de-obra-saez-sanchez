"""Arma la demo del panel en un solo HTML (estilos y scripts adentro) para compartirla como página.

Uso: python scripts/armar_demo_panel.py [salida]
Por defecto escribe salidas/panel-demo.html. La demo usa datos ficticios (panel/assets/demo.js)
y no necesita servidor. Sin <html>/<head>/<body>: la página que la publica agrega ese envoltorio.
"""
import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
PANEL = BASE / "panel"
CONFIG_DEMO = (
    "window.CONFIG_PANEL = { ENDPOINT: '', GOOGLE_CLIENT_ID: '', DEMO: true, ARTIFACT: true };\n"
)


def main():
    salida = Path(sys.argv[1]) if len(sys.argv) > 1 else BASE / "salidas" / "panel-demo.html"
    html = (PANEL / "index.html").read_text(encoding="utf-8")

    titulo = re.search(r"<title>.*?</title>", html).group(0)
    css = (PANEL / "assets" / "estilos.css").read_text(encoding="utf-8")
    cuerpo = re.search(r"<body>(.*)</body>", html, re.S).group(1)

    def script(m):
        nombre = m.group(1)
        codigo = CONFIG_DEMO if nombre == "assets/config.js" else (PANEL / nombre).read_text(encoding="utf-8")
        if "</script" in codigo:
            raise SystemExit(f"{nombre} contiene </script y rompería el HTML.")
        return f"<script>\n{codigo}</script>"

    cuerpo = re.sub(r'<script src="([^"]+)"></script>', script, cuerpo)
    pagina = f'{titulo}\n<meta name="robots" content="noindex">\n<style>\n{css}</style>\n{cuerpo.strip()}\n'
    salida.parent.mkdir(parents=True, exist_ok=True)
    salida.write_text(pagina, encoding="utf-8")
    print(f"Listo: {salida} ({len(pagina) // 1024} KB)")


if __name__ == "__main__":
    main()
