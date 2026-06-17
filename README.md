# BigQuery Release Notes Hub 🚀

An interactive, premium dashboard tracking official Google BigQuery release notes. It fetches the live RSS/Atom feed, parses and classifies updates, and serves them in a sleek, glassmorphic dark-themed single-page application.

---

## ✨ Features

* **Real-time Live Sync & Caching**:
  - Implements a server-side **5-minute memory cache** to respect feed limits and load instantly.
  - Automatically falls back to stale cache if the Google feed fails to resolve.
  - Real-time countdown timer in the header showing cache lifetime.
  - Manual **Sync / Force Refresh** button to fetch the latest updates immediately.
* **Smart Parsing & Categorization**:
  - Automatically segments multiple release notes posted on the same day.
  - Classifies updates into distinct categories: **Features**, **Changes**, **Issues**, **Breaking Changes**, and **Announcements**.
  - Auto-detects **Launch Stage** (General Availability vs. Preview) based on contents.
* **Interactive Statistics Bar**:
  - Overview panel showing counts for all update categories.
  - Click-to-isolate metrics: clicking any metric card instantly filters the list to that category.
* **Deep Searching & Filtering**:
  - **Fuzzy Search**: Filter notes instantly as you type (searches descriptions and categories).
  - **Multi-select Category Filter**: Toggle visibility of different release types.
  - **Launch Stage Filter**: Toggle between GA Only, Preview Only, or All Stages.
  - **Sorting**: Toggle between newest first (default) and oldest first.
  - Dynamic active filter chips for easily viewing and clearing active constraints.
* **Modern Social Integration**:
  - One-click **Tweet / X share** buttons on every release item.
  - Auto-formatting and smart truncation (respecting Twitter's 280-character limit and URL formatting rules) so updates are ready to post immediately.
* **Premium UX Design**:
  - Custom dark theme with glowing radial backgrounds and glassmorphic panels.
  - Custom styled input elements (checkboxes, radio buttons, and select dropdowns).
  - Responsive layout (fluid sidebar grid to single-column on mobile).
  - High-fidelity **Skeleton Loaders** for feed fetching transitions.

---

## 🛠️ Technology Stack

* **Backend**:
  - **Python 3.x**
  - **Flask (v3.0+)** for web server & API routes.
  - **urllib** & **xml.etree.ElementTree** for reliable feed retrieval and parsing.
* **Frontend**:
  - **HTML5** (Semantic layout).
  - **Vanilla CSS3** (Custom properties/variables, CSS grid, flexbox layout, pulse/rotate animations).
  - **Vanilla JavaScript (ES6+)** for client-side state management, live filtering, and share generation.
* **Assets**:
  - Fonts: *Inter* & *JetBrains Mono* (Google Fonts).
  - Icons: *Font Awesome 6* (Free library).

---

## 📁 Project Structure

```text
bq-releases-notes/
├── app.py                 # Flask app containing endpoints, parsing, and caching logic
├── requirements.txt       # Python dependencies (Flask)
├── .gitignore             # Configured Git exclusions (cache, venv, IDE files)
├── templates/
│   └── index.html         # Main dashboard markup, skeletons, and layouts
└── static/
    ├── style.css          # Design system, styling tokens, animations, and media queries
    └── main.js           # Client state, event listeners, dynamic UI, and filtering
```

---

## 🚀 Getting Started

Follow these steps to run the BigQuery Release Notes Hub locally:

### 1. Prerequisites
Ensure you have **Python 3.8+** and **Git** installed on your system.

### 2. Clone the Repository
```bash
git clone https://github.com/Bapan-01/Bapan-Gain-event-talks-app.git
cd Bapan-Gain-event-talks-app
```

### 3. Create a Virtual Environment (Recommended)
Set up an isolated Python environment:
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
```

### 4. Install Dependencies
Install Flask and standard packages:
```bash
pip install -r requirements.txt
```

### 5. Run the Server
Start the Flask development server:
```bash
python app.py
```

By default, the application will run at:  
👉 **[http://127.0.0.1:5000](http://127.0.0.1:5000)**

---

## 🛡️ License

This project is open-source. Feel free to clone, modify, and utilize it for your tracking workflows!
