"""Fixed, conceptual editorial illustrations; never assembly or dimensional drawings."""
from html import escape


def illustration(kind, caption, description):
    drawings = {
        'cartridge': '''<rect x="62" y="106" width="320" height="95" rx="12" fill="#584a36" stroke="#e6b873" stroke-width="3"/><path d="M382 112 Q447 114 470 153 Q447 192 382 195Z" fill="#ba7d50" stroke="#e6b873" stroke-width="3"/><rect x="49" y="100" width="16" height="107" rx="3" fill="#e6b873"/><circle cx="59" cy="153" r="10" fill="#f05a2a"/><path d="M59 98V49H130M197 105V65H250M430 109V43H388" fill="none" stroke="#d8ded8" stroke-width="2"/><text x="73" y="37">Primer at base</text><text x="181" y="53">Case</text><text x="319" y="31">Bullet / projectile</text><text x="115" y="151">Propellant inside case</text><text x="74" y="246">Cartridge = the complete round</text><text x="74" y="272">Bullet = one component</text>''',
        'firearm': '''<path d="M40 168L126 122H296L313 130H481V148H303L280 181H214L187 197H114L70 214Z" fill="#384743" stroke="#b3c2bb" stroke-width="3"/><rect x="317" y="134" width="163" height="10" fill="#6d7e77"/><path d="M214 181V213H253V178M126 130V73H66M267 122V46H191M388 133V78H352M480 139V42H416M232 210V249H306" stroke="#ff9674" stroke-width="2" fill="none"/><text x="38" y="61">Stock</text><text x="159" y="34">Receiver / action</text><text x="348" y="66">Barrel</text><text x="404" y="30">Muzzle</text><text x="302" y="258">Magazine</text><text x="40" y="278">Illustrative sporting rifle; parts vary by model</text>''',
        'sound': '''<rect x="33" y="29" width="464" height="69" rx="10" fill="#26312d" stroke="#697b70"/><rect x="33" y="113" width="464" height="69" rx="10" fill="#26312d" stroke="#697b70"/><rect x="33" y="197" width="464" height="69" rx="10" fill="#26312d" stroke="#697b70"/><text x="51" y="54">Muzzle report</text><text x="51" y="79" class="svg-small">A suppressor reduces this component</text><text x="51" y="138">Projectile shock wave</text><text x="51" y="163" class="svg-small">A separate sound when travel is supersonic</text><text x="51" y="222">Mechanical action + surroundings</text><text x="51" y="247" class="svg-small">Action noise and reflections remain</text>''',
    }
    if kind not in drawings:
        raise ValueError(f'Unknown illustration: {kind}')
    # No shared SVG IDs: accessible names belong to each SVG, without ID collisions.
    return (f'<figure class="guide-illustration"><figcaption>{escape(caption)}</figcaption>'
            f'<svg viewBox="0 0 530 305" role="img" aria-label="{escape(description, quote=True)}" '
            f'xmlns="http://www.w3.org/2000/svg"><title>{escape(caption)}</title>'
            f'<desc>{escape(description)}</desc>{drawings[kind]}</svg>'
            f'<p class="guide-visual-note">{escape(description)}</p></figure>')
