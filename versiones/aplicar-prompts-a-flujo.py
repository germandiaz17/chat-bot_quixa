"""Arma el flujo de n8n a partir de los prompts y del código en flujo/codigo/.

Uso:  python3 versiones/aplicar-prompts-a-flujo.py <carpeta-del-proyecto> [archivo-de-salida]
      Sin archivo de salida, actualiza flujo/quixa-consultor-virtual.json (la versión local).

Variables de entorno opcionales (para el servidor):
  QUIXA_DIR_LEADS   carpeta donde n8n guarda los leads (por defecto <proyecto>/leads)
  QUIXA_ORIGENES    dominios que pueden usar el chat, separados por coma (por defecto *)
"""
import json, os, pathlib, sys, uuid

base = pathlib.Path(sys.argv[1]).resolve()
flujo_path = base / 'flujo' / 'quixa-consultor-virtual.json'
codigo = base / 'flujo' / 'codigo'
d = json.loads(flujo_path.read_text())
leer = lambda p: p.read_text().rstrip() + '\n'
orientador = leer(base / 'prompts' / 'orientador.md')
extractor = leer(base / 'prompts' / 'extractor.md')
dir_leads = os.environ.get('QUIXA_DIR_LEADS', str(base / 'leads')).rstrip('/')
origenes = os.environ.get('QUIXA_ORIGENES', '*')

CODIGO = {
    'Preparar mensaje': 'preparar-mensaje.js',
    'Detectar cierre': 'detectar-cierre.js',
    'Armar transcripcion': 'armar-transcripcion.js',
    'Armar lead': 'armar-lead.js',
    'Buscar abandonadas': 'buscar-abandonadas.js',
}
CORS = lambda nodo: {'responseHeaders': {'entries': [
    {'name': 'Access-Control-Allow-Origin', 'value': "={{ $('%s').first().json.cors || '*' }}" % nodo}]}}

nodos = {n['name']: n for n in d['nodes']}

def asegurar(nombre, tipo, version, posicion, parametros):
    """Crea el nodo si no existe; si existe, le actualiza los parámetros."""
    if nombre not in nodos:
        n = {'id': str(uuid.uuid4()), 'name': nombre, 'type': tipo, 'typeVersion': version,
             'position': posicion, 'parameters': {}}
        d['nodes'].append(n)
        nodos[nombre] = n
    nodos[nombre]['parameters'] = parametros
    return nodos[nombre]

# Nodos nuevos: control de abuso y rescate de conversaciones abandonadas
asegurar('Bloqueado', 'n8n-nodes-base.if', 2.2, [-300, 200], {
    'conditions': {'options': {'caseSensitive': True, 'leftValue': '', 'typeValidation': 'loose', 'version': 2},
                   'conditions': [{'id': 'bloq', 'leftValue': '={{ $json.bloqueado }}', 'rightValue': '',
                                   'operator': {'type': 'boolean', 'operation': 'true', 'singleValue': True}}],
                   'combinator': 'and'},
    'looseTypeValidation': True})
asegurar('Responder bloqueo', 'n8n-nodes-base.respondToWebhook', 1.1, [-80, 380], {
    'respondWith': 'json',
    'responseBody': '={{ JSON.stringify({ reply: $json.aviso, fin: $json.bloqueo === "sesion" || $json.bloqueo === "cerrada", bloqueo: $json.bloqueo }) }}',
    'options': CORS('Preparar mensaje')})
asegurar('Cada 10 minutos', 'n8n-nodes-base.scheduleTrigger', 1.2, [-520, 620], {
    'rule': {'interval': [{'field': 'minutes', 'minutesInterval': 10}]}})
asegurar('Buscar abandonadas', 'n8n-nodes-base.code', 2, [-300, 620], {'jsCode': ''})
asegurar('Parcial a archivo', 'n8n-nodes-base.convertToFile', 1.1, [-80, 620], {
    'operation': 'toJson', 'mode': 'each', 'options': {'format': True}})
asegurar('Guardar parcial', 'n8n-nodes-base.readWriteFile', 1, [140, 620], {
    # convertToFile pierde el json original: el nombre se toma del item emparejado
    'operation': 'write', 'fileName': '=' + dir_leads + "/{{ $('Buscar abandonadas').item.json.nombreArchivo }}",
    'dataPropertyName': 'data', 'options': {}})

for name, n in nodos.items():
    p = n['parameters']
    if name in CODIGO:
        p['jsCode'] = leer(codigo / CODIGO[name])
    if name == 'Webhook Chat':
        p.setdefault('options', {})['allowedOrigins'] = origenes
    elif name == 'Consultor QUIXA':
        p['options']['systemMessage'] = orientador
    elif name == 'Extraer registro':
        p['text'] = '=' + extractor + '\n{{ $json.transcripcion_codificada }}'
    elif name == 'Gemini extractor':
        p['options']['maxOutputTokens'] = 8000
    elif name == 'Guardar en disco':
        p['fileName'] = '=' + dir_leads + "/{{ $('Armar lead').item.json.nombreArchivo }}"
    elif name == 'Responder turno':
        p['responseBody'] = '={{ JSON.stringify({ reply: $json.reply, fin: false, codigo: $json.codigo }) }}'
        p['options'] = CORS('Preparar mensaje')
    elif name == 'Responder cierre':
        # Al navegador solo va la despedida: la ficha (con análisis interno y referencias de inversión) no sale del servidor
        p['responseBody'] = "={{ JSON.stringify({ reply: $('Armar lead').item.json.reply, fin: true }) }}"
        p['options'] = CORS('Preparar mensaje')

def conectar(origen, destinos):
    """destinos: lista de salidas; cada salida es una lista de nombres de nodo."""
    d['connections'][origen] = {'main': [[{'node': x, 'type': 'main', 'index': 0} for x in salida] for salida in destinos]}

conectar('Preparar mensaje', [['Bloqueado']])
conectar('Bloqueado', [['Responder bloqueo'], ['Consultor QUIXA']])
conectar('Cada 10 minutos', [['Buscar abandonadas']])
conectar('Buscar abandonadas', [['Parcial a archivo']])
conectar('Parcial a archivo', [['Guardar parcial']])

salida = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else flujo_path
if salida != flujo_path:
    # Variante del servidor: n8n con Postgres exige un id para importar el flujo
    d.setdefault('id', 'quixaConsultor01')
    d['name'] = 'QUIXA · Consultor Virtual'
salida.write_text(json.dumps(d, ensure_ascii=False, indent=2))
print('flujo actualizado:', salida)
