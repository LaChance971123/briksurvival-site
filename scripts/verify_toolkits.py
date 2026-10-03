"""Exercise checkout gating, collection membership and publication leak prevention."""
import copy
import json
import shutil
import tempfile
from pathlib import Path
from lxml import html
from toolkit_catalog import load_catalog, purchase_control, guide_cta
from publication import public_files, check_path
from document_design import private_output_path

ROOT = Path(__file__).resolve().parents[1]
catalog = load_catalog(ROOT)
for product in catalog['products']:
    if product['status'] == 'retired':
        continue
    page = ROOT / 'dist/toolkits' / product['slug'] / 'index.html'
    document = html.fromstring(page.read_text())
    links = document.xpath('//a[@data-payhip-checkout]/@href')
    assert links == ([product['checkout_url']] if product['status'] == 'ready' else []), product['id']
    if product['status'] == 'planned':
        assert 'In development' in page.read_text()
        assert not document.xpath('//script[contains(text(),"Offer")]')

with tempfile.TemporaryDirectory() as directory:
    fixture = Path(directory)
    shutil.copytree(ROOT / 'content', fixture / 'content')
    shutil.copytree(ROOT / 'config', fixture / 'config')
    baseline = copy.deepcopy(catalog)

    def write(candidate):
        (fixture / 'content/toolkits.json').write_text(json.dumps(candidate))

    def reject(candidate):
        write(candidate)
        try:
            load_catalog(fixture)
        except (ValueError, TypeError):
            return
        raise AssertionError('Unsafe or incomplete catalogue accepted')

    candidate = copy.deepcopy(baseline)
    candidate['products'][0]['premium_manuscript'] = 'PRIVATE-CONTENT-CANARY'
    reject(candidate)
    candidate = copy.deepcopy(baseline)
    candidate['products'][0]['status'] = 'ready'
    reject(candidate)
    topic = copy.deepcopy(baseline['products'][0])
    topic.update(id='qa-topic', slug='qa-topic', kind='topic', status='ready', title='QA topic',
                 guide_slugs=['earthquake'], included_product_ids=[], price=2.99, edition='1.0',
                 payhip_product_id='QA123', checkout_url='https://payhip.com/buy?link=QA123', delivery_verified=True)
    valid = copy.deepcopy(baseline)
    valid['products'].append(topic)
    write(valid)
    result = load_catalog(fixture)
    assert 'data-payhip-checkout' in purchase_control(result['products'][-1])
    guide = json.loads((ROOT / 'content/guides/earthquake.json').read_text())
    assert '/toolkits/qa-topic/' in guide_cta(guide, result)
    for bad_url in ['https://payhip.com.evil.invalid/buy?link=QA123', 'http://payhip.com/buy?link=QA123',
                    'https://payhip.com/buy?link=OTHER', 'javascript:alert(1)', '/downloads/paid.pdf']:
        candidate = copy.deepcopy(valid)
        candidate['products'][-1]['checkout_url'] = bad_url
        reject(candidate)
    candidate = copy.deepcopy(valid)
    candidate['products'][-1]['delivery_verified'] = False
    reject(candidate)
    candidate = copy.deepcopy(valid)
    collection = candidate['products'][0]
    collection.update(status='ready', price=29.99, edition='1.0', payhip_product_id='QA456',
                      checkout_url='https://payhip.com/buy?link=QA456', delivery_verified=True,
                      included_product_ids=['qa-topic'])
    write(candidate)
    load_catalog(fixture)
    candidate['products'][-1].update(status='planned', payhip_product_id=None, checkout_url=None, delivery_verified=False)
    reject(candidate)

    write(baseline)
    (fixture / 'private').mkdir()
    (fixture / 'private/canary.html').write_text('PRIVATE-CONTENT-CANARY')
    (fixture / 'Assets').mkdir()
    (fixture / 'Assets/private-product.pdf').write_bytes(b'%PDF-PRIVATE-CONTENT-CANARY')
    allowed = public_files(fixture)
    assert 'private/canary.html' not in allowed and 'Assets/private-product.pdf' not in allowed
    for path in ['Assets/private-product.pdf', 'private/canary.html']:
        try:
            check_path(fixture, path)
        except ValueError:
            pass
        else:
            raise AssertionError('Private source or product file permitted')
    assert private_output_path(fixture / 'private-output.pdf').parent == fixture
    for path in [ROOT / 'downloads/paid.pdf', ROOT / 'Assets/paid.pdf', Path('relative-output.pdf')]:
        try:
            private_output_path(path)
        except ValueError:
            pass
        else:
            raise AssertionError('Document authoring accepted a public or implicit output location')
print('PASS: unreleased checkout gating, Payhip URL validation, topic mapping, collection membership and private-file exclusion.')
