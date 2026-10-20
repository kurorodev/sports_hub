"""Prepare supplied artwork from assets/; run on macOS, outputs are checked in."""
from pathlib import Path
from zipfile import ZipFile
import colorsys
import re
import subprocess
import unicodedata
import xml.etree.ElementTree as ET

frontend = Path(__file__).resolve().parents[1]
source = frontend.parent / 'assets'
public = frontend / 'public'
images = {
    'Глянцевая_эмблема_настольного_тенниса': 'table-tennis',
    'Глянцевый_логотип_бегуна_в_динамике': 'running',
    'Глянцевый_теннисный_эмблемный_вихрь': 'tennis',
    'Динамичный_глянцевый_логотип_волейбола': 'volleyball',
    'Золотой_вихрь_вокруг_шахматного_короля': 'chess',
    'Лыжник_в_динамическом_круговом_логотипе': 'skiing',
    'Минималистичная_эмблема_баскетбольного_вихря1': 'basketball',
    'Футбольный мяч в золотом вихре': 'football',
    'Минималистичная_спортивная_панорама': 'panorama',
}
files = {unicodedata.normalize('NFC', p.stem): p for p in source.glob('*.png')}
art = public / 'art/sports'
art.mkdir(parents=True, exist_ok=True)
for name, key in images.items():
    subprocess.run(['sips', '-s', 'format', 'jpeg', '-s', 'formatOptions', '85',
                    '--resampleWidth', '1600' if key == 'panorama' else '960',
                    str(files[name]), '--out', str(art / (key + '.jpg'))],
                   check=True, stdout=subprocess.DEVNULL)

ET.register_namespace('', 'http://www.w3.org/2000/svg')
with ZipFile(source / 'sport_avatars_10_svg_png.zip') as archive:
    for name in archive.namelist():
        if not name.startswith('svg/') or not name.endswith('.svg'):
            continue
        for tone, hue in [('organizer', None), ('user', .61), ('admin', .13)]:
            svg = ET.fromstring(archive.read(name))
            if hue is not None:
                for path in list(svg):
                    fill = path.get('fill', '')
                    if not re.fullmatch(r'#[0-9a-fA-F]{6}', fill):
                        continue
                    h, saturation, brightness = colorsys.rgb_to_hsv(
                        *(int(fill[i:i+2], 16) / 255 for i in [1, 3, 5]))
                    if not ((h > .94 or h < .02) and saturation > .65 and brightness > .3):
                        continue
                    groups = {False: [], True: []}
                    for shape in re.findall(r'M[^M]+', path.get('d', '')):
                        ys = [float(y) for _, y in re.findall(r'([-\d.]+),([-\d.]+)', shape)]
                        # Recolor clothing polygons, keeping facial details and hair accessories.
                        uniform = bool(ys) and max(ys) >= 300 and (min(ys) + max(ys)) / 2 >= 280
                        groups[uniform].append(shape)
                    if not groups[True]:
                        continue
                    color = '#' + ''.join(f'{round(c * 255):02x}' for c in colorsys.hsv_to_rgb(hue, saturation, brightness))
                    index = list(svg).index(path)
                    svg.remove(path)
                    for tinted, shapes in groups.items():
                        if shapes:
                            attributes = dict(path.attrib)
                            attributes['d'] = ' '.join(shapes)
                            attributes['fill'] = color if tinted else fill
                            if tinted:
                                # Close tiny gaps introduced by automatic tracing of the source.
                                attributes.update({'stroke': color, 'stroke-width': '2', 'stroke-linejoin': 'round'})
                            svg.insert(index, ET.Element(path.tag, attributes))
                            index += 1
            target = public / 'avatars' / tone
            target.mkdir(parents=True, exist_ok=True)
            (target / Path(name).name.replace('_', '-')).write_bytes(ET.tostring(svg))
print('Prepared 9 illustrations and 30 avatar variants.')
