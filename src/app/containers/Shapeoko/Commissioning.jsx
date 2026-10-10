import React from 'react';
import ProbeSetup from './ProbeSetup';

const workflow = {
  title: 'Bring the machine into service',
  steps: [
    ['Identify & inspect hardware', 'Confirm the Shapeoko 3 XL, DWP611, BitZero V2 and BitSetter installation. Isolate power before opening electronics. Identify controller and J Tech driver revisions before wiring; preserve existing probe adapter connections until their labels are confirmed. Check mounts, belts, cables, switches and the physical stop control.'],
    ['Verify router & tooling', 'Unplug the DWP611. Confirm a compatible precision ⅛″ collet is actually fitted and holds the cutter correctly. A conductive flat-end cutter can be used for probe checks; a smooth pin improves BitZero X/Y repeatability. The router switch and RPM dial are manual. M5 does not remove router power.'],
    ['Test both probe signals', 'At the machine, with router unplugged and laser power off, confirm readiness before connecting Grbl: opening serial can reset it. With no axes moving, test BitZero contact and release using the grounding magnet and conductive tool, keeping fingers clear of sharp edges. Park BitZero clear, then press and release BitSetter. Each must produce inactive → contact → inactive in a fresh controller report. A shared input cannot identify the accessory. Stop on a stuck, reversed or intermittent signal.'],
    ['Validate homing & travel', 'With the operator ready to stop motion, commission homing and verify all home switches. Measure the usable travel of this wide, shallow XL. Saved Y travel is 850 mm and remains unverified; do not rely on it for clearance. Coordinates alone do not prove successful homing. Do not change travel settings from a guessed machine size.'],
    ['Measure the BitSetter route', 'After validated homing, measure the button center in machine coordinates, a clear travel route, approach height and a short bounded search distance for the actual tooling. Historical X−33/Y−373.5 and approach/clearance values are unverified. Evaluate fixtures and the longest and shortest tools. The legacy Initial/New Tool Set macros remain unavailable because their reference and variable handling need replacement.'],
    ['Validate V2 zero & tool changes', 'Validate a reviewed V2-specific cycle with its documented geometry. XYZ corner and Z-only use different placement and offsets. Measure the first tool with BitSetter, establish stock zero with that same tool, then verify tool-change compensation preserves the datum. Test the same tool twice and a tool–replacement–original sequence against an independent reference. Record actual error against the job tolerance. Automatic cycles remain unavailable until implemented and validated.'],
    ['Commission the J Tech 7 W', 'Follow the laser handbook below. Identify the enclosed driver and controller boards before connecting PWM/GND. Verify mount clearance, enclosure, interlock, extraction and wavelength-appropriate protection. Validate focus and the CAM/controller power scale, including $30/$31/$32, through supervised commissioning. This page neither changes laser mode nor fires the laser. Router probe routines do not establish laser focus.'],
    ['Check camera & release readiness', 'Open the webcam preview and check lighting, focus and coverage of the tool, stock and clamps. A camera is observational and does not replace an operator at the machine. Record completed hardware checks, measured geometry, probe repeatability and any outstanding defects. Keep the FabForge machine restricted until commissioning is reviewed; no checkbox here marks the machine available. Daily setup and job release remain separate, and Start is always a separate action.'],
  ],
};

export default function Commissioning(props) {
  return <ProbeSetup {...props} workflow={workflow} />;
}
