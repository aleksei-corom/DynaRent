import os
import re
import base64
import html
from pathlib import Path
import pymupdf
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

WORKSPACE_DIR = Path(r"d:\Proyectos\DynaRent")
MD_PATH = WORKSPACE_DIR / "MANUAL_DE_USUARIO.md"
PDF_PATH = WORKSPACE_DIR / "MANUAL_DE_USUARIO_DYNARENT.pdf"
HTML_PATH = WORKSPACE_DIR / "MANUAL_DE_USUARIO_PREVIEW.html"
LOGO_PATH = WORKSPACE_DIR / "static" / "LogoDynarent.png"

def image_to_base64(img_path: Path) -> str:
    if not img_path.exists():
        print(f"Warning: image not found: {img_path}")
        return ""
    ext = img_path.suffix.lower().replace(".", "")
    if ext == "jpg":
        ext = "jpeg"
    mime = f"image/{ext}"
    with open(img_path, "rb") as f:
        data = base64.b64encode(f.read()).decode("utf-8")
    return f"data:{mime};base64,{data}"

def load_logo_base64() -> str:
    if LOGO_PATH.exists():
        return image_to_base64(LOGO_PATH)
    dynarent_png = WORKSPACE_DIR / "static" / "dynarent.png"
    if dynarent_png.exists():
        return image_to_base64(dynarent_png)
    return ""

def slugify(text: str) -> str:
    # remove emojis and special chars
    clean = re.sub(r"[^\w\s-]", "", text.lower(), flags=re.UNICODE)
    clean = re.sub(r"[\s_-]+", "-", clean).strip("-")
    return clean

def parse_markdown_to_html(md_content: str) -> str:
    lines = md_content.splitlines()
    html_parts = []
    
    in_table = False
    table_lines = []
    
    in_blockquote = False
    blockquote_lines = []
    blockquote_type = "quote"
    
    in_list = False
    list_type = None
    list_level = 0
    
    fig_counter = 0

    def flush_table():
        nonlocal in_table, table_lines
        if not table_lines:
            in_table = False
            return
        
        header_row = None
        rows = []
        for line in table_lines:
            line_clean = line.strip()
            if not line_clean.startswith("|"):
                continue
            cols = [c.strip() for c in line_clean.split("|")[1:-1]]
            if all(re.match(r"^:?-+:?$", c) for c in cols if c):
                continue
            if header_row is None:
                header_row = cols
            else:
                rows.append(cols)
                
        table_html = ['<div class="table-container"><table class="styled-table">']
        if header_row:
            table_html.append('<thead><tr>')
            for col in header_row:
                table_html.append(f'<th>{inline_format(col)}</th>')
            table_html.append('</tr></thead>')
        if rows:
            table_html.append('<tbody>')
            for row in rows:
                table_html.append('<tr>')
                for col in row:
                    table_html.append(f'<td>{inline_format(col)}</td>')
                table_html.append('</tr>')
            table_html.append('</tbody>')
        table_html.append('</table></div>')
        html_parts.append('\n'.join(table_html))
        table_lines = []
        in_table = False

    def flush_blockquote():
        nonlocal in_blockquote, blockquote_lines, blockquote_type
        if not blockquote_lines:
            in_blockquote = False
            return
            
        full_text = " ".join(blockquote_lines)
        
        if "🔒" in full_text or "restringido" in full_text.lower():
            clean_text = full_text.replace("🔒", "").replace("*", "").strip()
            html_parts.append(f'''
            <div class="security-banner">
                <div class="security-banner-icon">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                </div>
                <div class="security-banner-content">
                    <span class="security-tag">CONTROL DE SEGURIDAD (RBAC)</span>
                    <span class="security-desc">{clean_text}</span>
                </div>
            </div>
            ''')
            blockquote_lines = []
            in_blockquote = False
            blockquote_type = "quote"
            return

        icon_svg = ""
        box_class = "callout-quote"
        title = "Información del Sistema"
        
        if blockquote_type == "note":
            box_class = "callout-note"
            title = "Nota Operativa"
            icon_svg = '<svg class="callout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
        elif blockquote_type == "warning":
            box_class = "callout-warning"
            title = "Advertencia de Seguridad"
            icon_svg = '<svg class="callout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
        elif blockquote_type == "tip":
            box_class = "callout-tip"
            title = "Consejo Operativo"
            icon_svg = '<svg class="callout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>'
        else:
            icon_svg = '<svg class="callout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'

        body_html = "<br>".join([inline_format(l) for l in blockquote_lines if l.strip()])
        html_parts.append(f'''
        <div class="callout {box_class}">
            <div class="callout-header">
                {icon_svg}
                <span class="callout-title">{title}</span>
            </div>
            <div class="callout-body">{body_html}</div>
        </div>
        ''')
        blockquote_lines = []
        in_blockquote = False
        blockquote_type = "quote"

    def close_lists():
        nonlocal in_list, list_type, list_level
        if in_list:
            while list_level > 0:
                html_parts.append(f'</{list_type}>')
                list_level -= 1
            in_list = False
            list_type = None

    def inline_format(text: str) -> str:
        # math inline or block
        def math_sub(m):
            math_text = m.group(1).replace(r"\text{", "").replace("}", "")
            return f'<code class="formula-inline">{math_text}</code>'
        text = re.sub(r"\$\$(.*?)\$\$", math_sub, text)
        
        # bold **text**
        text = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", text)
        # italic *text*
        text = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<em>\1</em>", text)
        # code `code`
        text = re.sub(r"`(.+?)`", r"<code>\1</code>", text)
        # links [text](url)
        text = re.sub(r"\[(.+?)\]\((.+?)\)", r'<a href="\2">\1</a>', text)
        return text

    # Pre-filter out the metadata blockquote lines 1-7 since it's already in the Cover Page
    clean_lines = []
    skip_header = True
    for line in lines:
        if skip_header:
            if line.startswith("## 📑 Tabla de Contenidos") or line.startswith("## Tabla de Contenidos"):
                skip_header = False
                clean_lines.append(line)
            continue
        clean_lines.append(line)

    lines = clean_lines
    i = 0
    total_lines = len(lines)
    
    in_toc = False
    toc_items = []

    while i < total_lines:
        raw_line = lines[i]
        line = raw_line.rstrip()
        stripped = line.strip()

        # Handle Table of Contents
        if "Tabla de Contenidos" in stripped and stripped.startswith("##"):
            in_toc = True
            i += 1
            continue

        if in_toc:
            # Match list item: 1. [Title](#link)
            toc_match = re.match(r"^(\d+)\.\s+\[(.*?)\]\((.*?)\)", stripped)
            if toc_match:
                num = int(toc_match.group(1))
                t_title = toc_match.group(2)
                t_link = toc_match.group(3)
                toc_items.append((num, t_title, t_link))
                i += 1
                continue
            elif stripped.startswith("---") or (stripped.startswith("##") and "1." in stripped):
                # End of TOC
                in_toc = False
                # Render luxury Table of Contents page
                toc_html = ['<div class="toc-page">',
                            '<div class="toc-header">',
                            '<div class="toc-badge">ESTRUCTURA DEL DOCUMENTO</div>',
                            '<h2 class="toc-title">Tabla de Contenidos</h2>',
                            '<p class="toc-subtitle">Guía de referencia rápida y mapa de navegación modular del sistema</p>',
                            '</div>',
                            '<div class="toc-grid">']
                for num, t_title, t_link in toc_items:
                    # Clean section link slug
                    target_slug = f"seccion-{num}"
                    toc_html.append(f'''
                    <a href="#{target_slug}" class="toc-item">
                        <span class="toc-num">{num:02d}</span>
                        <span class="toc-text">{t_title}</span>
                        <span class="toc-arrow">&rarr;</span>
                    </a>
                    ''')
                toc_html.append('</div></div>')
                html_parts.append("\n".join(toc_html))
                # Do not increment i if it's already the start of Section 1
                if stripped.startswith("---"):
                    i += 1
                continue
            elif not stripped:
                i += 1
                continue

        # Check Table
        if stripped.startswith("|"):
            close_lists()
            if in_blockquote:
                flush_blockquote()
            in_table = True
            table_lines.append(stripped)
            i += 1
            continue
        elif in_table:
            flush_table()

        # Check Blockquote / Callout
        if stripped.startswith(">"):
            close_lists()
            bq_content = stripped[1:].strip()
            if not in_blockquote:
                in_blockquote = True
                blockquote_lines = []
                blockquote_type = "quote"
            
            if bq_content.startswith("[!NOTE]"):
                blockquote_type = "note"
                bq_content = bq_content[7:].strip()
            elif bq_content.startswith("[!WARNING]"):
                blockquote_type = "warning"
                bq_content = bq_content[10:].strip()
            elif bq_content.startswith("[!TIP]"):
                blockquote_type = "tip"
                bq_content = bq_content[6:].strip()
            
            if bq_content:
                blockquote_lines.append(bq_content)
            i += 1
            continue
        elif in_blockquote:
            flush_blockquote()

        # Check Empty line
        if not stripped:
            close_lists()
            i += 1
            continue

        # Check Horizontal Rule
        if re.match(r"^---+$", stripped):
            close_lists()
            html_parts.append('<hr class="section-divider">')
            i += 1
            continue

        # Check Math standalone $$...$$
        if stripped.startswith("$$") and stripped.endswith("$$") and len(stripped) > 4:
            close_lists()
            math_text = stripped[2:-2].strip().replace(r"\text{", "").replace("}", "")
            html_parts.append(f'''
            <div class="formula-card">
                <div class="formula-badge">REGLA DE CÁLCULO ESTÁNDAR</div>
                <div class="formula-text">{math_text}</div>
            </div>
            ''')
            i += 1
            continue

        # Check Image: ![alt](url)
        img_match = re.match(r"^!\[(.*?)\]\((.*?)\)$", stripped)
        if img_match:
            close_lists()
            fig_counter += 1
            alt_text = img_match.group(1)
            raw_url = img_match.group(2)
            decoded_path = raw_url.replace("%20", " ")
            local_img_path = WORKSPACE_DIR / decoded_path
            
            b64_src = image_to_base64(local_img_path)
            if not b64_src:
                b64_src = f"file:///{local_img_path.as_posix()}"
                
            caption = alt_text if alt_text else f"Captura de pantalla {fig_counter}"
            
            html_parts.append(f'''
            <figure class="figure-container">
                <div class="image-wrapper">
                    <img src="{b64_src}" alt="{caption}" class="manual-image" loading="eager" />
                </div>
                <figcaption class="figure-caption">
                    <span class="caption-num">Figura {fig_counter}:</span> {caption}
                </figcaption>
            </figure>
            ''')
            i += 1
            continue

        # Check Headings
        h_match = re.match(r"^(#{1,4})\s+(.+)$", stripped)
        if h_match:
            close_lists()
            level = len(h_match.group(1))
            heading_text = h_match.group(2).strip()
            
            if level == 2:
                sec_match = re.match(r"^(\d+)\.\s*(.+)$", heading_text)
                if sec_match:
                    num = int(sec_match.group(1))
                    title = sec_match.group(2)
                    sec_anchor = f"seccion-{num}"
                    html_parts.append(f'''
                    <div class="section-heading-container" id="{sec_anchor}">
                        <div class="section-number-pill">{num:02d}</div>
                        <h2 class="section-title">{title}</h2>
                    </div>
                    ''')
                else:
                    sec_anchor = slugify(heading_text)
                    html_parts.append(f'''
                    <div class="section-heading-container" id="{sec_anchor}">
                        <h2 class="section-title">{heading_text}</h2>
                    </div>
                    ''')
            elif level == 3:
                sec_anchor = slugify(heading_text)
                html_parts.append(f'<h3 class="subsection-title" id="{sec_anchor}">{inline_format(heading_text)}</h3>')
            elif level == 4:
                sec_anchor = slugify(heading_text)
                html_parts.append(f'<h4 class="subsubsection-title" id="{sec_anchor}">{inline_format(heading_text)}</h4>')
            
            i += 1
            continue

        # Check Lists (ordered and unordered)
        ol_match = re.match(r"^(\d+)\.\s+(.+)$", stripped)
        ul_match = re.match(r"^[-*]\s+(.+)$", stripped)
        
        if ol_match:
            if not in_list or list_type != "ol":
                close_lists()
                in_list = True
                list_type = "ol"
                list_level = 1
                html_parts.append('<ol class="styled-ol">')
            html_parts.append(f'<li>{inline_format(ol_match.group(2))}</li>')
            i += 1
            continue
        elif ul_match:
            if not in_list or list_type != "ul":
                close_lists()
                in_list = True
                list_type = "ul"
                list_level = 1
                html_parts.append('<ul class="styled-ul">')
            
            html_parts.append(f'<li>{inline_format(ul_match.group(1))}</li>')
            i += 1
            continue
        else:
            close_lists()

        # Regular Paragraph
        p_text = inline_format(stripped)
        html_parts.append(f'<p class="paragraph">{p_text}</p>')
        i += 1

    if in_table:
        flush_table()
    if in_blockquote:
        flush_blockquote()
    close_lists()

    return "\n".join(html_parts)

def build_full_html() -> str:
    with open(MD_PATH, "r", encoding="utf-8") as f:
        md_text = f.read()

    logo_b64 = load_logo_base64()
    body_content = parse_markdown_to_html(md_text)

    css = """
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

    :root {
        --primary: #1e3a8a;
        --primary-light: #2563eb;
        --primary-dark: #0f172a;
        --accent: #0284c7;
        --accent-light: #38bdf8;
        --slate-50: #f8fafc;
        --slate-100: #f1f5f9;
        --slate-200: #e2e8f0;
        --slate-300: #cbd5e1;
        --slate-500: #64748b;
        --slate-600: #475569;
        --slate-700: #334155;
        --slate-800: #1e293b;
        --slate-900: #0f172a;
    }

    * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
    }

    body {
        font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        color: var(--slate-800);
        background: #ffffff;
        font-size: 10pt;
        line-height: 1.55;
        -webkit-font-smoothing: antialiased;
    }

    @page {
        size: letter portrait;
        margin: 18mm 16mm 18mm 16mm;
    }

    /* COVER PAGE */
    .cover-page {
        page-break-after: always;
        break-after: page;
        height: 100%;
        min-height: 890px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 40px 30px;
        position: relative;
        background: radial-gradient(circle at 100% 0%, #f0f7ff 0%, #ffffff 55%);
        border: 1px solid var(--slate-200);
        border-radius: 12px;
    }

    .cover-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 2px solid var(--slate-200);
        padding-bottom: 22px;
    }

    .cover-logo {
        max-height: 68px;
        max-width: 250px;
        object-fit: contain;
    }

    .cover-system-tag {
        font-size: 8.5pt;
        font-weight: 700;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        color: var(--primary-light);
        background: #eff6ff;
        padding: 7px 16px;
        border-radius: 20px;
        border: 1px solid #bfdbfe;
    }

    .cover-center {
        margin: auto 0;
        padding: 24px 0;
    }

    .cover-kicker {
        font-size: 11pt;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 2px;
        color: var(--accent);
        margin-bottom: 10px;
    }

    .cover-title {
        font-size: 34pt;
        font-weight: 800;
        color: var(--slate-900);
        line-height: 1.12;
        letter-spacing: -0.5px;
        margin-bottom: 12px;
    }

    .cover-title span {
        color: var(--primary-light);
    }

    .cover-subtitle {
        font-size: 13pt;
        font-weight: 400;
        color: var(--slate-600);
        line-height: 1.45;
        max-width: 620px;
        margin-bottom: 28px;
    }

    .cover-meta-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 14px;
        margin-top: 20px;
        max-width: 650px;
    }

    .meta-box {
        background: #ffffff;
        border: 1px solid var(--slate-200);
        border-left: 4px solid var(--primary-light);
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.02);
    }

    .meta-label {
        font-size: 7.5pt;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: var(--slate-500);
        margin-bottom: 3px;
    }

    .meta-value {
        font-size: 9.5pt;
        font-weight: 700;
        color: var(--slate-900);
    }

    .cover-footer {
        border-top: 1px solid var(--slate-200);
        padding-top: 18px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 8.5pt;
        color: var(--slate-600);
    }

    .badge-confidential {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #fef2f2;
        color: #991b1b;
        border: 1px solid #fecaca;
        font-weight: 600;
        padding: 4px 12px;
        border-radius: 12px;
    }

    /* TABLE OF CONTENTS PAGE */
    .toc-page {
        page-break-after: always;
        break-after: page;
        min-height: 860px;
        padding-top: 10px;
    }

    .toc-header {
        border-bottom: 2px solid var(--slate-200);
        padding-bottom: 16px;
        margin-bottom: 22px;
    }

    .toc-badge {
        font-size: 8pt;
        font-weight: 700;
        color: var(--primary-light);
        letter-spacing: 1.5px;
        text-transform: uppercase;
        margin-bottom: 4px;
    }

    .toc-title {
        font-size: 20pt;
        font-weight: 800;
        color: var(--slate-900);
        letter-spacing: -0.4px;
        margin-bottom: 4px;
    }

    .toc-subtitle {
        font-size: 9.5pt;
        color: var(--slate-500);
    }

    .toc-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        column-gap: 20px;
        row-gap: 10px;
    }

    .toc-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 14px;
        background: var(--slate-50);
        border: 1px solid var(--slate-200);
        border-radius: 8px;
        text-decoration: none;
        color: var(--slate-800);
        transition: all 0.2s ease;
    }

    .toc-num {
        font-size: 9pt;
        font-weight: 800;
        color: #ffffff;
        background: var(--primary);
        width: 26px;
        height: 26px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .toc-text {
        font-size: 9pt;
        font-weight: 600;
        color: var(--slate-800);
        flex-grow: 1;
        line-height: 1.3;
    }

    .toc-arrow {
        font-size: 10pt;
        color: var(--slate-400);
        font-weight: 700;
    }

    /* DOCUMENT CONTENT */
    .document-body {
        padding: 0 4px;
    }

    .section-divider {
        border: none;
        height: 1px;
        background: linear-gradient(90deg, var(--slate-200), transparent);
        margin: 24px 0 16px 0;
    }

    /* Section Headings */
    .section-heading-container {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-top: 32px;
        margin-bottom: 16px;
        padding-bottom: 10px;
        border-bottom: 2px solid var(--slate-200);
        page-break-before: always;
        break-before: page;
    }

    .section-number-pill {
        background: linear-gradient(135deg, var(--primary), var(--accent));
        color: #ffffff;
        font-size: 11pt;
        font-weight: 800;
        width: 34px;
        height: 34px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 6px rgba(30, 58, 138, 0.2);
        flex-shrink: 0;
    }

    .section-title {
        font-size: 15pt;
        font-weight: 800;
        color: var(--slate-900);
        letter-spacing: -0.3px;
        line-height: 1.25;
    }

    .subsection-title {
        font-size: 11.5pt;
        font-weight: 700;
        color: var(--primary);
        margin-top: 20px;
        margin-bottom: 10px;
        page-break-after: avoid;
        break-after: avoid;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .subsection-title::before {
        content: "";
        display: inline-block;
        width: 4px;
        height: 15px;
        background: var(--accent);
        border-radius: 2px;
    }

    .subsubsection-title {
        font-size: 10.5pt;
        font-weight: 700;
        color: var(--slate-800);
        margin-top: 14px;
        margin-bottom: 8px;
        page-break-after: avoid;
        break-after: avoid;
    }

    .paragraph {
        margin-bottom: 11px;
        text-align: justify;
        color: var(--slate-700);
    }

    /* Lists */
    .styled-ol, .styled-ul {
        margin: 8px 0 14px 22px;
        color: var(--slate-700);
    }

    .styled-ol li, .styled-ul li {
        margin-bottom: 5px;
        padding-left: 4px;
    }

    /* Figures and Images */
    .figure-container {
        margin: 16px auto 20px auto;
        page-break-inside: avoid;
        break-inside: avoid;
        text-align: center;
        max-width: 95%;
    }

    .image-wrapper {
        border-radius: 8px;
        overflow: hidden;
        border: 1px solid var(--slate-200);
        box-shadow: 0 4px 16px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -1px rgba(15, 23, 42, 0.04);
        background: #ffffff;
        display: inline-block;
        width: 100%;
    }

    .manual-image {
        display: block;
        width: auto;
        max-width: 100%;
        max-height: 380px;
        margin: 0 auto;
        object-fit: contain;
        background: #ffffff;
    }

    .figure-caption {
        margin-top: 7px;
        font-size: 8pt;
        color: var(--slate-600);
        font-style: italic;
    }

    .caption-num {
        font-weight: 700;
        font-style: normal;
        color: var(--primary);
    }

    /* Callouts */
    .callout {
        margin: 14px 0;
        border-radius: 8px;
        padding: 12px 16px;
        page-break-inside: avoid;
        break-inside: avoid;
        border: 1px solid transparent;
    }

    .callout-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 5px;
    }

    .callout-icon {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
    }

    .callout-title {
        font-weight: 700;
        font-size: 8.5pt;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .callout-body {
        font-size: 9pt;
        line-height: 1.45;
    }

    .callout-note {
        background: #f0fdf4;
        border-color: #bbf7d0;
        color: #166534;
    }
    .callout-note .callout-icon { stroke: #16a34a; }

    .callout-warning {
        background: #fffbeb;
        border-color: #fde68a;
        color: #92400e;
    }
    .callout-warning .callout-icon { stroke: #d97706; }

    .callout-tip {
        background: #eff6ff;
        border-color: #bfdbfe;
        color: #1e40af;
    }
    .callout-tip .callout-icon { stroke: #2563eb; }

    .callout-quote {
        background: #f8fafc;
        border-color: #e2e8f0;
        color: var(--slate-700);
        border-left: 4px solid var(--primary);
    }

    /* Security Role Banner */
    .security-banner {
        display: flex;
        align-items: center;
        gap: 12px;
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-left: 4px solid #dc2626;
        border-radius: 8px;
        padding: 10px 14px;
        margin: 16px 0;
        page-break-inside: avoid;
        break-inside: avoid;
    }

    .security-banner-icon {
        color: #dc2626;
        flex-shrink: 0;
        display: flex;
        align-items: center;
    }

    .security-banner-content {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .security-tag {
        font-size: 7.5pt;
        font-weight: 800;
        letter-spacing: 1px;
        color: #991b1b;
        text-transform: uppercase;
    }

    .security-desc {
        font-size: 9pt;
        font-weight: 600;
        color: #7f1d1d;
    }

    /* Tables */
    .table-container {
        margin: 16px 0;
        overflow: hidden;
        border-radius: 8px;
        border: 1px solid var(--slate-200);
        page-break-inside: avoid;
        break-inside: avoid;
    }

    .styled-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 9pt;
        text-align: left;
    }

    .styled-table thead th {
        background: var(--slate-900);
        color: #ffffff;
        font-weight: 600;
        padding: 9px 12px;
        letter-spacing: 0.3px;
    }

    .styled-table tbody td {
        padding: 9px 12px;
        border-bottom: 1px solid var(--slate-200);
        color: var(--slate-700);
    }

    .styled-table tbody tr:nth-child(even) {
        background: #f8fafc;
    }

    .styled-table tbody tr:last-child td {
        border-bottom: none;
    }

    /* Formula Card */
    .formula-card {
        background: #f8fafc;
        border: 1px solid var(--slate-200);
        border-left: 4px solid var(--accent);
        border-radius: 8px;
        padding: 12px 16px;
        margin: 14px 0;
        page-break-inside: avoid;
        break-inside: avoid;
    }

    .formula-badge {
        font-size: 7.5pt;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--accent);
        letter-spacing: 1px;
        margin-bottom: 4px;
    }

    .formula-text {
        font-family: 'JetBrains Mono', monospace;
        font-size: 9.5pt;
        font-weight: 600;
        color: var(--slate-900);
        background: #ffffff;
        padding: 8px 12px;
        border-radius: 6px;
        border: 1px solid var(--slate-200);
        display: inline-block;
    }

    .formula-inline {
        font-family: 'JetBrains Mono', monospace;
        font-size: 8.5pt;
        font-weight: 600;
        color: var(--primary);
        background: #eff6ff;
        padding: 2px 6px;
        border-radius: 4px;
        border: 1px solid #bfdbfe;
    }

    code {
        font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
        font-size: 8pt;
        background: var(--slate-100);
        color: #0f172a;
        padding: 2px 5px;
        border-radius: 4px;
        border: 1px solid var(--slate-200);
    }

    a {
        color: var(--primary-light);
        text-decoration: none;
    }

    strong {
        color: var(--slate-900);
        font-weight: 600;
    }
    """

    full_html = f"""<!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>DynaRent ERP — Manual de Usuario y Operaciones</title>
        <style>
            {css}
        </style>
    </head>
    <body>
        <!-- Portada Ejecutiva -->
        <div class="cover-page">
            <div class="cover-top">
                {'<img src="' + logo_b64 + '" class="cover-logo" alt="Logo DynaRent">' if logo_b64 else '<div style="font-size:20pt; font-weight:800; color:#1e3a8a;">DYNARENT ERP</div>'}
                <div class="cover-system-tag">Manual Oficial de Usuario</div>
            </div>

            <div class="cover-center">
                <div class="cover-kicker">Guía Oficial de Operación y Administración</div>
                <h1 class="cover-title">DynaRent <span>ERP</span></h1>
                <div class="cover-subtitle">Sistema Integral de Gestión de Flota, Operación de Rentas, Mantenimiento Automotriz y Control Financiero</div>

                <div class="cover-meta-grid">
                    <div class="meta-box">
                        <div class="meta-label">Versión de la Plataforma</div>
                        <div class="meta-value">v1.0.30+ (Producción)</div>
                    </div>
                    <div class="meta-box">
                        <div class="meta-label">Motor de Base de Datos</div>
                        <div class="meta-value">Firebird Embedded 5.0</div>
                    </div>
                    <div class="meta-box">
                        <div class="meta-label">Arquitectura y Seguridad</div>
                        <div class="meta-value">Tauri V2 + Rust + AES-256-GCM</div>
                    </div>
                    <div class="meta-box">
                        <div class="meta-label">Alcance de Audiencia</div>
                        <div class="meta-value">Administrador, Supervisor y Operador</div>
                    </div>
                </div>
            </div>

            <div class="cover-footer">
                <div>
                    <strong>DynaRent Fleet & Rental Solutions</strong> &bull; Edición 2026
                </div>
                <div class="badge-confidential">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                    Documento Corporativo
                </div>
            </div>
        </div>

        <!-- Contenido del Manual -->
        <main class="document-body">
            {body_content}
        </main>
    </body>
    </html>
    """
    return full_html

def generate_pdf():
    print("1. Parsing Markdown to High-End HTML...")
    rendered_html = build_full_html()

    with open(HTML_PATH, "w", encoding="utf-8") as f:
        f.write(rendered_html)
    print(f"   HTML generado en: {HTML_PATH}")

    print("2. Starting Headless Chrome via Selenium...")
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--run-all-compositor-stages-before-draw")

    driver = webdriver.Chrome(options=options)
    
    file_url = HTML_PATH.as_uri()
    print(f"   Navegando a: {file_url}")
    driver.get(file_url)

    driver.implicitly_wait(3)

    print("3. Executing CDP Page.printToPDF with Header & Footer...")
    header_html = """
    <div style="font-size: 7.5pt; width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 0 35px; color: #64748b; font-family: 'Segoe UI', Arial, sans-serif; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">
        <span style="font-weight: 600; color: #1e3a8a;">DynaRent ERP &mdash; Manual de Usuario y Operaciones</span>
        <span>Versi&oacute;n v1.0.30+</span>
    </div>
    """

    footer_html = """
    <div style="font-size: 7.5pt; width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 0 35px; color: #94a3b8; font-family: 'Segoe UI', Arial, sans-serif; border-top: 1px solid #e2e8f0; padding-top: 4px;">
        <span>Documento Confidencial &bull; DynaRent Fleet Systems</span>
        <span>P&aacute;gina <span class="pageNumber"></span> de <span class="totalPages"></span></span>
    </div>
    """

    cdp_params = {
        "landscape": False,
        "displayHeaderFooter": True,
        "headerTemplate": header_html,
        "footerTemplate": footer_html,
        "printBackground": True,
        "paperWidth": 8.5,
        "paperHeight": 11.0,
        "marginTop": 0.45,
        "marginBottom": 0.45,
        "marginLeft": 0.45,
        "marginRight": 0.45,
        "preferCSSPageSize": True
    }

    pdf_result = driver.execute_cdp_cmd("Page.printToPDF", cdp_params)
    pdf_bytes = base64.b64decode(pdf_result["data"])
    driver.quit()

    temp_raw_pdf = WORKSPACE_DIR / "temp_raw.pdf"
    with open(temp_raw_pdf, "wb") as f:
        f.write(pdf_bytes)

    print("4. Post-processing with PyMuPDF (removing running header/footer from Cover Page)...")
    doc = pymupdf.open(temp_raw_pdf)
    if len(doc) > 0:
        page_0 = doc[0]
        # Cover top header area (y: 0 to 44 pt)
        page_0.draw_rect(pymupdf.Rect(0, 0, 612, 44), color=(1,1,1), fill=(1,1,1))
        # Cover bottom footer area (y: 748 to 792 pt)
        page_0.draw_rect(pymupdf.Rect(0, 748, 612, 792), color=(1,1,1), fill=(1,1,1))
    
    doc.save(PDF_PATH)
    doc.close()
    
    if temp_raw_pdf.exists():
        temp_raw_pdf.unlink()

    file_size = PDF_PATH.stat().st_size
    print(f"5. PDF Profesional creado exitosamente: {PDF_PATH} ({file_size:,} bytes)")

if __name__ == "__main__":
    generate_pdf()
