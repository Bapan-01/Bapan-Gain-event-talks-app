import re
import time
import urllib.request
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Cache configuration: Cache data in memory for 5 minutes (300 seconds)
CACHE_DURATION = 300
cache = {
    "data": None,
    "last_fetched": 0
}

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
ATOM_NS = {'atom': 'http://www.w3.org/2005/Atom'}

def fetch_and_parse_feed():
    """Fetches the XML feed from Google Cloud and parses it into structured JSON-serializable data."""
    try:
        req = urllib.request.Request(
            FEED_URL, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            xml_data = response.read()
        
        root = ET.fromstring(xml_data)
        entries = root.findall('atom:entry', ATOM_NS)
        
        parsed_entries = []
        for entry in entries:
            title = entry.find('atom:title', ATOM_NS)
            title_text = title.text.strip() if title is not None and title.text else "Release Note"
            
            updated = entry.find('atom:updated', ATOM_NS)
            updated_text = updated.text.strip() if updated is not None and updated.text else ""
            
            # Formatted date for sorting and displaying (YYYY-MM-DD)
            # E.g., 2026-06-15T00:00:00-07:00 -> 2026-06-15
            date_str = ""
            if updated_text:
                match = re.match(r'^(\d{4}-\d{2}-\d{2})', updated_text)
                if match:
                    date_str = match.group(1)
            
            id_elem = entry.find('atom:id', ATOM_NS)
            id_text = id_elem.text.strip() if id_elem is not None and id_elem.text else ""
            
            link_elem = entry.find('atom:link', ATOM_NS)
            link_href = link_elem.attrib.get('href', '') if link_elem is not None else ""
            
            content_elem = entry.find('atom:content', ATOM_NS)
            html = content_elem.text if content_elem is not None and content_elem.text else ""
            
            # Split HTML content by <h3> headers to segment individual release items
            matches = list(re.finditer(r'<h3>(.*?)</h3>', html))
            items = []
            
            if not matches:
                # Fallback if there are no H3 headers - treat as General Announcement
                html_stripped = html.strip()
                if html_stripped:
                    is_preview = bool(re.search(r'\bpreview\b', html_stripped, re.IGNORECASE))
                    is_ga = bool(re.search(r'\bgenerally available\b|\bga\b', html_stripped, re.IGNORECASE))
                    items.append({
                        'category': 'Announcement',
                        'description': html_stripped,
                        'is_preview': is_preview,
                        'is_ga': is_ga
                    })
            else:
                for i, match in enumerate(matches):
                    category = match.group(1).strip()
                    start = match.end()
                    end = matches[i+1].start() if i + 1 < len(matches) else len(html)
                    desc = html[start:end].strip()
                    
                    # Determine launch stage from description
                    is_preview = bool(re.search(r'\bpreview\b', desc, re.IGNORECASE))
                    is_ga = bool(re.search(r'\bgenerally available\b|\bga\b', desc, re.IGNORECASE))
                    
                    items.append({
                        'category': category,
                        'description': desc,
                        'is_preview': is_preview,
                        'is_ga': is_ga
                    })
            
            parsed_entries.append({
                'title': title_text,
                'date': date_str,
                'updated': updated_text,
                'id': id_text,
                'link': link_href,
                'items': items
            })
            
        return {
            "success": True,
            "releases": parsed_entries,
            "source": "live",
            "cached_at": time.time()
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "releases": []
        }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    current_time = time.time()
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    
    # Return cached data if valid and fetch succeeded (and we are not forcing a refresh)
    if not force_refresh and cache["data"] and cache["data"]["success"] and (current_time - cache["last_fetched"] < CACHE_DURATION):
        response_data = cache["data"].copy()
        response_data["source"] = "cache"
        response_data["expires_in_sec"] = int(CACHE_DURATION - (current_time - cache["last_fetched"]))
        return jsonify(response_data)
    
    # Fetch and parse
    res = fetch_and_parse_feed()
    if res["success"]:
        cache["data"] = res
        cache["last_fetched"] = current_time
        res_copy = res.copy()
        res_copy["expires_in_sec"] = CACHE_DURATION
        return jsonify(res_copy)
    else:
        # If fetch fails, fallback to stale cache if available
        if cache["data"]:
            res_stale = cache["data"].copy()
            res_stale["source"] = "stale_cache_fallback"
            res_stale["fallback_error"] = res["error"]
            return jsonify(res_stale)
        return jsonify(res), 500

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
