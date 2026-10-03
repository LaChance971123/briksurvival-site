"""Rich editorial sections, with support for the original heading/body pairs."""
from html import escape as e


def text(value):
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return ' '.join(text(v) for v in value)
    if isinstance(value, dict):
        return ' '.join(text(v) for k, v in value.items() if k not in ('url', 'kind', 'type', 'references'))
    return ''


def heading(section):
    return section['heading'] if isinstance(section, dict) else section[0]


def render_sections(sections):
    output = []
    for n, section in enumerate(sections, 1):
        title = heading(section)
        blocks = section.get('blocks', []) if isinstance(section, dict) else [{'type': 'paragraph', 'text': section[1]}]
        body = []
        for b in blocks:
            kind = b['type']
            if kind == 'paragraph':
                body.append(f'<p>{e(b["text"])}</p>')
            elif kind in ('bullets', 'steps'):
                tag = 'ol' if kind == 'steps' else 'ul'
                body.append(f'<{tag} class="guide-detail-list">' + ''.join(f'<li>{e(item)}</li>' for item in b['items']) + f'</{tag}>')
            elif kind == 'table':
                columns = b['columns']
                assert all(len(row) == len(columns) for row in b['rows']), title
                body.append(f'<div class="guide-table-scroll" tabindex="0" role="region" aria-label="{e(b["caption"], quote=True)}"><table class="guide-table"><caption>{e(b["caption"])}</caption><thead><tr>' + ''.join(f'<th scope="col">{e(c)}</th>' for c in columns) + '</tr></thead><tbody>' + ''.join('<tr>' + ''.join(f'<th scope="row">{e(c)}</th>' if i == 0 else f'<td>{e(c)}</td>' for i, c in enumerate(row)) + '</tr>' for row in b['rows']) + '</tbody></table></div>')
            elif kind == 'callout':
                body.append(f'<aside class="guide-note"><h3>{e(b["title"])}</h3><p>{e(b["text"])}</p></aside>')
            elif kind == 'flow':
                body.append(f'<figure class="guide-process"><figcaption>{e(b["caption"])}</figcaption><ol>' + ''.join(f'<li><span aria-hidden="true">{i:02}</span><h3>{e(label)}</h3><p>{e(detail)}</p></li>' for i, (label, detail) in enumerate(b['items'], 1)) + '</ol>' + f'<p class="guide-visual-note">{e(b["note"])}</p></figure>')
            elif kind == 'links':
                assert all(x['url'].startswith('/') and not x['url'].startswith('//') for x in b['items'])
                body.append('<nav class="guide-companions" aria-label="Related detail">' + ''.join(f'<a href="{e(x["url"], quote=True)}">{e(x["label"])}</a>' for x in b['items']) + '</nav>')
            else:
                raise ValueError(f'Unknown guide block: {kind}')
        if isinstance(section, dict) and section.get('references'):
            body.append('<p class="guide-section-source">Reference: ' + ' · '.join(f'<a href="{e(url, quote=True)}" target="_blank" rel="noopener noreferrer">{e(label)}</a>' for label, url in section['references']) + '</p>')
        output.append(f'<section id="detail-{n}" class="guide-section guide-deep-dive"><h2>{e(title)}</h2>{"".join(body)}</section>')
    return ''.join(output)
