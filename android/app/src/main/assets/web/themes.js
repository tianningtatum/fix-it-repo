// Fix-It: four program versions. Symbols are 48x48 SVG fragments, stroked in currentColor.
var F_ = ' fill="currentColor" stroke="none"';
var FIXTHEMES = {
  ce: {
    id: 'ce', file: 'CraneCrisis_CivilEng.html', title: 'CRANE CRISIS', program: 'Civil Engineering',
    machine: 'Tower Crane Controller',
    tagline: 'The site\'s tower crane is failing. One of you sees the controller. Everyone else holds a piece of the repair manual.',
    mods: { wires: 'Signal Cables', gauge: 'Load Moment', keypad: 'Drawing Symbols', switches: 'Safety Interlocks', procedure: 'Lift Sequence' },
    gaugeUnit: '%', gaugePrefix: 'LM', posWord: 'Step',
    steps: ['Check Wind', 'Release Brake', 'Raise Hook', 'Slew Left', 'Lock Jib', 'Sound Horn'],
    symbols: [
      '<circle cx="24" cy="27" r="15"/><path d="M24 4l7 23H17z"' + F_ + '/>',
      '<circle cx="18" cy="24" r="11"/><path d="M7 24h22M29 24h14M37 18l6 6-6 6"/>',
      '<path d="M5 32h38M16 18h16l-8 14z"/>',
      '<path d="M24 4v14M6 18h36M10 18l-5 8M18 18l-5 8M26 18l-5 8M34 18l-5 8M42 18l-5 8"/>',
      '<path d="M24 14L13 30h22z M6 30h36M11 30l-4 7M19 30l-4 7M27 30l-4 7M35 30l-4 7"/>',
      '<path d="M24 10L13 26h22z M6 38h36"/><circle cx="17" cy="32" r="4"/><circle cx="31" cy="32" r="4"/>',
      '<rect x="11" y="11" width="26" height="26"/><path d="M11 11l26 26M37 11L11 37"/>',
      '<path d="M10 8h28v6H27v20h11v6H10v-6h11V14H10z"/>',
      '<circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="7"' + F_ + '/>',
      '<path d="M3 24h42" stroke-dasharray="11 4 3 4"/><path d="M28 6a7 7 0 1 0 0 10M30 4v14h7"/>',
      '<circle cx="24" cy="24" r="14"/><path d="M24 10v28M10 24h28"/><path d="M24 10a14 14 0 0 1 14 14H24zM24 38a14 14 0 0 1-14-14h14z"' + F_ + '/>',
      '<path d="M24 4v30M15 25l9 11 9-11M6 42h36"/>'
    ],
    colors: { bg: '#16130f', plate: '#241f19', plate2: '#302921', edge: '#4a4033', ink: '#f2ede5', dim: '#ab9f8d', accent: '#ff8a1f', accentInk: '#1f1000', accent2: '#ffd166' },
    debrief: [
      'The operator had to describe drawing symbols. How did your team agree on what to call each one? What happened when someone said "the triangle thing"?',
      'Manual holders couldn\'t see the controller. Did the operator trust your instructions or second-guess them? Did that change when a quieter teammate was operator?',
      'On a real site, the engineer with the drawings and the operator in the crane are different people. What did this show about how they should talk?'
    ]
  },
  ee: {
    id: 'ee', file: 'RelayRescue_ElectricalEng.html', title: 'RELAY RESCUE', program: 'Electrical Engineering',
    machine: 'Protection Relay Panel',
    tagline: 'A substation relay panel is tripping. One of you sees the panel. Everyone else holds a piece of the repair manual.',
    mods: { wires: 'Control Wiring', gauge: 'Bus Voltage', keypad: 'Circuit Symbols', switches: 'Breaker Bank', procedure: 'Switching Order' },
    gaugeUnit: 'kV', gaugePrefix: 'BV', posWord: 'Tap',
    steps: ['Open Breaker', 'Rack Out', 'Ground Bus', 'Close Isolator', 'Reset Relay', 'Sync Generator'],
    symbols: [
      '<path d="M3 24h8l3-8 5 16 5-16 5 16 5-16 3 8h8"/>',
      '<path d="M3 24h17M28 24h17M20 11v26M28 11v26"/>',
      '<path d="M3 28h6a5 5 0 0 1 10 0a5 5 0 0 1 10 0a5 5 0 0 1 10 0h6"/>',
      '<path d="M3 24h13M32 24h13M16 12v24l16-12zM32 12v24"/>',
      '<path d="M3 26h11M30 26h15M14 15v22l16-11zM30 15v22M30 11l7-7M33 4h4v4M37 15l7-7M40 8h4v4"/>',
      '<path d="M24 5v19M8 24h32M14 31h20M20 38h8"/>',
      '<path d="M3 24h15M36 24h9M18 10v28M24 17v14M30 10v28M36 17v14"/>',
      '<rect x="13" y="17" width="22" height="14" rx="2"/><path d="M3 24h42"/>',
      '<path d="M3 30h10M35 30h10M14 30l18-13"/><circle cx="14" cy="30" r="2.5"/><circle cx="34" cy="30" r="2.5"/>',
      '<circle cx="24" cy="24" r="12"/><path d="M15.5 15.5l17 17M32.5 15.5l-17 17M3 24h9M36 24h9"/>',
      '<circle cx="24" cy="24" r="15"/><path d="M13 24c3-9 8-9 11 0s8 9 11 0"/>',
      '<circle cx="24" cy="24" r="15"/><path d="M16 32V16l8 10 8-10v16"/>'
    ],
    colors: { bg: '#0c111b', plate: '#172031', plate2: '#1f2b40', edge: '#33445f', ink: '#eaeff7', dim: '#97a5bb', accent: '#ffd400', accentInk: '#1c1700', accent2: '#55d6ff' },
    debrief: [
      'Circuit symbols: did everyone use the same names? What happened when someone said "the zigzag one" or "the one with arrows"?',
      'The operator couldn\'t see the rules and the readers couldn\'t see the panel. Who double-checked before an action? Did it slow you down or save you?',
      'Real switching orders are read back before anyone acts. Did your team start doing read-backs on its own?'
    ]
  },
  cpe: {
    id: 'cpe', file: 'DebugSquad_ComputerEng.html', title: 'DEBUG SQUAD', program: 'Computer Engineering',
    machine: 'Embedded Controller Board',
    tagline: 'A field controller board keeps crashing. One of you sees the board. Everyone else holds a piece of the debug manual.',
    mods: { wires: 'Jumper Wires', gauge: 'Core Temp', keypad: 'Logic Symbols', switches: 'DIP Switches', procedure: 'Boot Sequence' },
    gaugeUnit: '°C', gaugePrefix: 'CT', posWord: 'Mode',
    steps: ['Flash Firmware', 'Init Clock', 'Mount Drive', 'Start Wi-Fi', 'Run Self-Test', 'Enable Watchdog'],
    symbols: [
      '<path d="M10 11h13a13 13 0 0 1 0 26H10zM3 18h7M3 30h7M36 24h9"/>',
      '<path d="M9 11c11 0 21 5 27 13-6 8-16 13-27 13 4-7 4-19 0-26zM3 18h8M3 30h8M36 24h9"/>',
      '<path d="M12 11c11 0 20 5 26 13-6 8-15 13-26 13 4-7 4-19 0-26zM6 11c4 7 4 19 0 26M2 18h10M2 30h10M38 24h7"/>',
      '<path d="M7 11h12a13 13 0 0 1 0 26H7zM2 18h5M2 30h5M38 24h7"/><circle cx="35" cy="24" r="3"/>',
      '<path d="M6 11c10 0 19 5 25 13-6 8-15 13-25 13 4-7 4-19 0-26zM2 18h7M2 30h7M38 24h7"/><circle cx="34.5" cy="24" r="3"/>',
      '<path d="M10 11v26l20-13zM2 24h8M36 24h9"/><circle cx="33" cy="24" r="3"/>',
      '<path d="M12 11v26l22-13zM3 24h9M34 24h11"/>',
      '<path d="M3 33h7V15h10v18h10V15h10v18h5"/>',
      '<path d="M24 45V21M24 21L11 5M24 21L37 5M24 21V5"/>',
      '<rect x="14" y="9" width="20" height="30" rx="2"/><path d="M7 15h7M7 24h7M7 33h7M34 15h7M34 24h7M34 33h7"/><circle cx="19" cy="14" r="1.8"' + F_ + '/>',
      '<path d="M14 35h22a8 8 0 0 0 0-16 11 11 0 0 0-21-2 9 9 0 0 0-1 18z"/>',
      '<ellipse cx="24" cy="11" rx="13" ry="5"/><path d="M11 11v26c0 3 6 5 13 5s13-2 13-5V11M11 24c0 3 6 5 13 5s13-2 13-5"/>'
    ],
    colors: { bg: '#08160f', plate: '#0f2619', plate2: '#153222', edge: '#285640', ink: '#e7f2eb', dim: '#91b5a2', accent: '#e8b84a', accentInk: '#1e1500', accent2: '#7ee0a3' },
    debrief: [
      'Debugging over voice: what made a description useful, and what made it useless? Give one example from your team.',
      'The manual was split across phones. How long did it take to figure out who had which page? What would have made it faster?',
      'Logic gate symbols: did people who knew the names take over, or did they help others keep up?'
    ]
  },
  me: {
    id: 'me', file: 'ChillerChaos_MechanicalEng.html', title: 'CHILLER CHAOS', program: 'Mechanical Engineering',
    machine: 'Chiller Plant Controller',
    tagline: 'The building\'s chiller plant is about to trip. One of you sees the controller. Everyone else holds a piece of the O&M manual.',
    mods: { wires: 'Sensor Leads', gauge: 'Discharge Pressure', keypad: 'P&ID Symbols', switches: 'Valve Bank', procedure: 'Startup Sequence' },
    gaugeUnit: 'psi', gaugePrefix: 'DP', posWord: 'Stage',
    steps: ['Start Pump', 'Open Valve', 'Start Tower Fan', 'Prime Line', 'Reset Trip', 'Start Compressor'],
    symbols: [
      '<path d="M5 13L24 24 5 35zM43 13L24 24 43 35z"/>',
      '<path d="M5 13L24 24 5 35zM43 13L24 24 43 35z"/><circle cx="24" cy="24" r="4.5"' + F_ + '/>',
      '<path d="M5 13L24 24 5 35zM43 13L24 24 43 35z"/><circle cx="24" cy="24" r="6"/>',
      '<path d="M5 13L24 24 5 35z"' + F_ + '/><path d="M43 13L24 24 43 35z"/>',
      '<path d="M8 11v26M40 11v26M14 35L34 13"/><circle cx="24" cy="24" r="3"' + F_ + '/>',
      '<path d="M24 26L13 44h22zM24 26l18-11v22zM24 26v-4l-5-2 10-3-10-3 10-3-5-2V5"/>',
      '<circle cx="22" cy="26" r="14"/><path d="M22 12h22"/>',
      '<circle cx="24" cy="24" r="15"/><path d="M12 15l24 5M12 33l24-5"/>',
      '<circle cx="24" cy="24" r="16"/><path d="M24 24c0-9 7-11 9-7s-4 7-9 7zM24 24c-8 4-13 0-10-3s8 0 10 3zM24 24c7 5 4 11 0 11s-3-7 0-11z"/>',
      '<circle cx="24" cy="24" r="16"/><path d="M5 30l8-13 6 13 6-13 6 13 6-13 6 8"/>',
      '<path d="M24 5L43 24 24 43 5 24z"/><path d="M24 7v34" stroke-dasharray="3 4"/>',
      '<rect x="12" y="5" width="24" height="38" rx="11"/>'
    ],
    colors: { bg: '#10161c', plate: '#1b252e', plate2: '#24313b', edge: '#374853', ink: '#e9eef2', dim: '#97a8b4', accent: '#3fa9f5', accentInk: '#001a2c', accent2: '#ff7a45' },
    debrief: [
      'Valve symbols look alike. How did your team tell a globe valve from a gate valve or a ball valve over voice?',
      'When the operator\'s time was running out, who stayed calm and who rushed? What did the team do about it?',
      'In a plant, the operator on the floor relies on the people with the drawings and procedures. When did you trust the manual over your own instinct?'
    ]
  }
};
if (typeof module !== 'undefined') module.exports = FIXTHEMES;
