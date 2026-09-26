# Neon Garage 🏎️✨

**Neon Garage** is a futuristic, highly interactive supercar garage that transforms your Chrome New Tab page into a premium sci-fi automotive laboratory. Instead of a boring productivity dashboard, every new tab feels like entering your own personal luxury garage.

<p align="center">
  <img src="assets/screenshots/Screenshot (47).png" alt="Neon Garage Dashboard" width="800">
</p>

## ✨ Features

* **Cinematic Experience**: Complete with engine startup sounds, smooth animated lights, and cinematic camera sweeps when you navigate.
* **Vehicle Customization**: Personalize your hypercars with custom paint colors, wheel styles, and advanced lighting accents.
* **Interactive HUD & Telemetry**: Monitor real-time stats, system diagnostics, holographic blueprints, and time/weather dynamically.
* **Multiple Environments**: Choose from different high-end environments (Midnight Garage, Neon City, Space Hangar, Desert, Rain).
* **Smart Dashboard**: A sleek, horizontal glassmorphic quick-launch panel containing your favorite sites and the ability to dynamically add and manage your own custom links.
* **Offline First & Lightweight**: Built entirely with HTML5, CSS3, and Vanilla JavaScript—no heavy frameworks, React, or external APIs. 
* **State Persistence**: Your customizations, garage collection, and shortcut links are instantly saved to Chrome local storage.

## 📸 Gallery

<p align="center">
  <img src="assets/screenshots/Screenshot (48).png" alt="Customization Menu" width="49%">
  <img src="assets/screenshots/Screenshot (49).png" alt="Vehicle Diagnostics" width="49%">
</p>
<p align="center">
  <img src="assets/screenshots/Screenshot (50).png" alt="Environments" width="49%">
  <img src="assets/screenshots/Screenshot (51).png" alt="Custom Links" width="49%">
</p>

## 🚀 Installation

Because this is a custom Manifest V3 extension, you can easily load it into Chrome locally:

1. Download or clone this repository to your computer.
2. Open Google Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** using the toggle switch in the top right corner.
4. Click the **Load unpacked** button.
5. Select the `Neon-Garage` directory.
6. Open a new tab and start your engines! 🏁

## 🛠️ Technology Stack

* **Manifest V3** New Tab Override
* **HTML5** & **CSS3** (Extensive use of CSS variables, glassmorphism, and complex keyframe animations)
* **Vanilla JavaScript** (ES Modules, `chrome.storage.local`, Web Audio API)
* Zero external UI dependencies

## 📂 Project Structure

```text
Neon-Garage/
├── manifest.json
├── assets/
│   ├── cars/         # High-res vehicle renders
│   ├── icons/        # Extension icons
│   ├── sounds/       # Engine and UI SFX
│   └── screenshots/  # Repository images
├── newtab/
│   ├── newtab.html   # Main structure & HUD layout
│   ├── newtab.css    # Premium styling & animations
│   ├── newtab.js     # Core application logic & UI bindings
│   └── sounds.js     # Web Audio manager
└── README.md
```

## ⌨️ Secrets & Easter Eggs
Try the Konami code or explore the settings panel for hidden developer telemetries and classified experimental vehicles... 

---
*Created with ❤️ for automotive and cyberpunk enthusiasts.*
