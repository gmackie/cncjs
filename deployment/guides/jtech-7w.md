# J Tech 7W laser guide

**Shapeoko 3 XL · J Tech Photonics 7W diode laser · FabForge/CNCjs**  
Revision: 2026-10-09. Installation, commissioning and daily operation.

## 1. Scope and present status

Your laser is identified as **7W**, but the driver board is inside a 3D-printed case and its revision has not been identified. The exact head/lens, Carbide controller revision, connectors and focus arrangement also need confirmation. Wiring and laser output are **not commissioned**. The machine remains restricted in FabForge.

This guide gives a complete preparation and operating sequence, but **does not assign connector pins or a focus distance to unidentified hardware**. J Tech’s linked Shapeoko article spans old and new mounting/driver generations. Its photos are not interchangeable pinouts. Finish the identification record below before connecting signal wiring or enabling output.

The Pi workstation is **http://192.168.68.138:8000**; jobs and authorization belong to Graham Mackie’s workspace on FabForge. The J Tech page in CNCjs is a workflow view: opening it does not set laser mode or enable the laser.

## 2. Identify the kit before wiring

With Shapeoko power, laser supply and router mains disconnected, and USB disconnected where it could power controller logic, inspect accessible labels. Do not open a mains power supply. If the printed driver cover hides identification, remove only its low-voltage enclosure cover according to the maker’s instructions, or ask J Tech to identify it from photographs.

Record:

| Item | What to capture |
| --- | --- |
| Laser head | Model, serial, rated optical power, wavelength, lens/shroud and warning label |
| Driver | Model/revision, input-voltage requirement, signal connector labels, switch/jumper functions, interlock/key/reset controls |
| Controller | Carbide board revision and clear photo of the PWM/GND labels and surrounding connectors |
| Power supply | Maker, model, DC voltage, current rating and polarity; confirm it belongs to this driver |
| Harness | Both connector ends, labels, polarity and the J Tech kit/harness part number |
| Mount | Front/side/dust-boot style, magnetic/mechanical retention, supplied fasteners and any limit-switch spacer |
| Focus | Exact head/lens instructions, reference surface, supplied spacer/gauge and specified distance |

Send this information to J Tech support if any mapping is unclear. Do not identify an input only by wire color, case shape, a neighboring pin or an older internet picture. The red-PWM/black-GND and H4 examples in the Shapeoko article apply only after matching that pictured hardware.

## 3. Prepare the laser work area

Treat an accessible 7W beam as a **Class 4 laser hazard**: direct and reflected light can injure eyes and skin, and the beam can ignite material.

- Use an enclosure designed for the actual laser wavelength and accessible power, with beam containment and a properly designed interlock. Verify the protective performance of windows/shielding; ordinary tinted plastic is not laser shielding.
- Use eyewear specified for the actual wavelength and required optical density by J Tech/the safety assessment. “Laser glasses,” color alone, or glasses included with an unrelated kit are not sufficient. Eyewear supplements containment; it does not make an open-beam machine safe for bystanders.
- Provide local fume extraction to a suitable discharge or filtration arrangement for the material. Router dust collection is not automatically adequate fume extraction. Remove accumulated wood dust and chips from the machine and collection area.
- Use a noncombustible, appropriate laser bed/backing that contains transmitted beam energy. Account for reflections from exposed metal, fixtures and honeycomb. Never engrave directly onto the wooden spoilboard as the only beam stop.
- Keep a suitable fire extinguisher and accessible power isolation nearby. Never run unattended; the webcam is not fire detection or an interlock.
- Use only known, laser-compatible materials with manufacturer/SDS confirmation. Do not process PVC/vinyl, unknown plastics or unknown coatings. Do not assume treated/painted wood, leather, composites, ABS or polycarbonate are suitable. Confirm material-specific hazards before use.
- Keep the **DWP611 unplugged** for laser work. Remove the cutting bit and any dust boot/fixture that can obstruct the beam or travel. No loose reflective tools in the enclosure.

## 4. Mechanical installation — all power isolated

1. Identify the mount generation and follow its supplied instructions. J Tech’s current metal front mount uses different hardware from older printed and magnetic mounts; do not copy screw length or hole selection between them.
2. Fit the bracket to the intended spindle-clamp mounting points. Support the assembly and use the specified screws. Do not distort a printed mount, clamp on a cable, or loosen the router motor mounting unintentionally.
3. Seat the laser fully in its mount and use the specified retention screws where supplied. Confirm it cannot detach or rotate during travel. Keep the optics and fan openings clear.
4. Mount the driver in a protected, ventilated position with its required clearances. Keep it away from cutting dust, fumes, conductive debris and moving parts. Do not drill an electronics enclosure with the electronics inside; remove/protect the electronics and remove all swarf first.
5. Route head, fan, signal and power cables with strain relief, correct extension harnesses and slack at both ends of travel. Keep them out of belts, rails, screws and the router’s cutting envelope. Never hot-plug the head or fan.
6. If the head has manufacturer-supported air assist, connect the specified tubing and supply. Do not invent an air pressure or fit an unapproved nozzle that obstructs the beam/cooling.
7. Check the full motion and homing envelope before powered laser testing. Older J Tech mounts sometimes need a supplied X-limit actuation block; newer magnetic mounts may not. Verify your actual switch can trigger **before collision**, rather than assuming the article’s date-specific instructions apply.
8. The laser’s offset from the router reduces/changes its usable work area. Record that envelope separately. Do not assume every router-reachable point is laser-reachable.

## 5. Electrical installation — stop if the mapping is uncertain

The intended **signal-level** relationship is:

| From | To | Condition |
| --- | --- | --- |
| Controller’s documented spindle PWM output | Driver’s documented TTL/PWM control input | Match voltage range, polarity, connector and board revisions |
| Controller signal GND | Driver’s documented signal return | Use the approved harness/mapping |
| Matched laser DC supply | Driver power input | Verify voltage, polarity and rating |
| Driver laser output | Matched 7W head | Use the designated laser harness only |
| Designated fan output/supply | Head fan | Follow this kit’s fan wiring instructions |

This table is **not a connector pinout**. Never put supply voltage on a PWM input, connect the diode directly to the Shapeoko board, or confuse a driver laser-output socket with its control-input socket. Do not use controller 5V to power the laser.

1. Isolate all supplies and USB-powered logic. Confirm no stored/live power remains per the hardware instructions.
2. Match both boards and the harness against J Tech’s exact instructions. If they differ from the public Shapeoko article, use J Tech’s confirmed mapping for your pair of boards.
3. Install the approved connector/harness. Use a press-fit connector only where the kit explicitly supports that PCB/header; do not force it into different holes. An ISP header is not a universal alternative pinout.
4. Route the signal pair cleanly and secure connections against vibration. Check continuity/polarity using suitable test equipment only with the equipment isolated, and without putting test voltage into the laser diode.
5. Connect the matched laser, fan and supply cables to their identified outputs/inputs. Set the driver for the manufacturer’s **external control** mode. Do not guess test/continuous/jumper positions, current adjustments or reset behavior.
6. Have the wiring reviewed before reapplying power. Document how the physical stop, key and interlock isolate emission. Software M5 and Feed hold do not replace these devices.
7. Do not share the PWM output with an unreviewed router relay. A relay can respond to laser commands, while milling M3 can enable a connected laser. Until a proper mutually exclusive tool-enable design is verified, physically isolate the inactive tool.

## 6. Grbl, CAM and power scale

Previously recorded firmware is **Grbl 1.1f.20170131**, with `$30=1000`, `$31=0`, `$32=0`. Read the current configuration before changing anything. The saved values are not a live guarantee.

- `$32=1` selects Grbl laser mode; `$32=0` restores spindle/milling mode. These are persistent configuration changes, performed by an administrator through an approved maintenance procedure with laser power isolated. The badge-operated UI deliberately blocks arbitrary configuration changes.
- `$30` is the maximum S scale. Set CAM/LightBurn **S-value max to the actual controller $30**. With $30=1000 and $31=0, S100 is nominally 10% commanded duty, not a calibrated optical-watt measurement or a safe exposure level. Do not change $30 to match a random tutorial.
- `M4` is Grbl 1.1 dynamic laser power, varying output with actual motion speed. It is commonly suitable for engraving. `M3` is constant-power mode and can emit while stationary. Neither is an interlock. Use a validated postprocessor and inspect which mode it emits.
- `M5` requests output off. Firmware, wiring and driver faults can defeat software assumptions; retain physical isolation.
- Verify units, feed units, absolute/relative positioning, work coordinate system, travel envelope, start/end output-off behavior and origin. Do not include unreviewed focus/fire commands, probing macros or unsupported M6/tool changes.
- The controller has suspect XL Y travel and disabled soft/hard limits in the saved configuration. Resolve travel and homing during commissioning. Do not “fix” it by entering a guessed bed size into LightBurn.

J Tech recommends LightBurn for laser design/CAM. For **this appliance workflow**, use it to prepare and export compatible G-code, then attach that exact file to FabForge for review and release. Do not connect LightBurn and CNCjs to the same controller simultaneously or bypass the machine’s access workflow with a second sender.

## 7. Focus and laser origin

1. Identify the exact lens/shroud and use its supplied gauge or documented mechanical reference. Focus with laser power isolated whenever the gauge permits.
2. Do **not** universally apply “⅛″ above the surface.” J Tech’s mixed-generation article gives that distance for a particular shroud, and a different reference for unshrouded heads. Neither establishes the correct distance for your unidentified 7W assembly.
3. Place the actual stock at its final height, secure it, and set head height using the correct reference surface. Check that clamps and air-assist parts will clear every programmed move.
4. Set the work origin for the **laser beam location**, not the router bit location. The head is offset from the spindle. Prefer a directly established laser origin; apply a stored offset only after measuring and validating it for this mount. Avoid applying the offset in both CAM and CNCjs.
5. Do not run BitSetter or router tool-length routines with the laser mounted. A BitSetter measurement does not establish laser focus.
6. Do not improvise a stationary “fire” command for alignment. If an emission-based alignment step is required, follow the identified head’s manufacturer procedure only after containment, interlocks and supervised emission commissioning are complete.

## 8. First commissioning

A trained operator must be at the machine with the enclosure/protection ready and immediate physical power isolation. This guide does not supply an arbitrary burn power/feed pair: the first test must use the **identified head’s** procedure and known material.

1. Record the head/driver/controller identities, wiring approval and current Grbl settings. Resolve the Shapeoko’s homing/travel discrepancy first.
2. With laser supply isolated and router unplugged, verify axis directions, homing clearance, work envelope, cable travel, frame/origin and focus mechanically. Check the whole toolpath with emission physically disabled, including approach/return moves.
3. Verify the external-control signal and default-off behavior using the driver maker’s test method and suitable instrumentation. Test boot, USB reconnect, sender disconnect, controller reset and program end under controlled conditions. Stop if emission can occur unexpectedly.
4. Commission enclosure/key/interlock and physical stop behavior according to the equipment design. Do not open a door against a live beam to “try” an unverified interlock, defeat an interlock, or assume loss of communications guarantees output off.
5. With protection/extraction in operation and known scrap on a suitable bed, perform the maker’s supervised first-output test. Keep exposure limited by its prescribed procedure. Confirm the expected response to program output-off and physical isolation before general use.
6. Run a small material test pattern from a reviewed file. Start from the head/material maker’s recommended engraving settings. Record focus, stock, feed, power scale, percentage, passes, air assist and result. Do not infer cutting ability from the 7W label alone.
7. Inspect for scorching, sustained flame, excessive smoke, missed steps or position error. Stop and correct problems before increasing energy. Never leave it running to “see whether it clears.”
8. Record commissioning results in FabForge. An administrator can then evaluate machine availability and operator training grants. No software checkbox substitutes for these physical checks.

## 9. Daily engraving workflow

1. Confirm you are trained and authorized for this machine/process. Inspect the enclosure, interlock, optics, cables, mount, fan, extraction and laser bed. Clean away milling dust and chips.
2. Unplug the DWP611 and remove its bit; configure the laser mount/focus and safe workholding. Keep the laser output disabled while setting up.
3. Connect the controller through CNCjs only when prepared for a possible reset. Home using the commissioned procedure. Verify current laser mode, power scale and origin; ask the administrator to resolve configuration differences.
4. In FabForge, select the work order, setup sheet, approved material and exact G-code artifact. In **Work queue**, review the toolpath/simulation and all setup evidence. Simulation does not predict ignition, optical exposure, actual focus or material fumes.
5. Badge in. Release the exact file **for setup**, load it, and verify its bounding area and approach moves using the commissioned non-emitting procedure. If the file is revised, repeat review/release.
6. Close the enclosure, establish required protection and extraction, and enable the laser using its commissioned key/interlock sequence. Do not leave it armed while changing stock or walking away.
7. Press **Start** separately. Watch the entire job at the machine. A camera is a supplemental view; dark or frozen video must not be used to judge safe operation.
8. At the end, verify motion/output have stopped, disable the laser using the hardware controls and allow fumes to clear before opening the enclosure. Isolate power before adjusting the head, cables or optics.
9. Inspect the part, report actual quantity/outcome in FabForge and badge out. Record settings for repeatability, including failures and test coupons.

## 10. Pause, faults and emergency response

- **Feed hold is not an emergency stop.** It requests a motion pause. Do not rely on it to remove laser power, particularly with constant-power M3, an unknown driver or a fault.
- For unexpected emission, sustained flame, loss of containment, loose work or motion failure, use the physical laser isolation/stop immediately if safe. Follow the shop’s fire procedure; if the fire is not immediately controllable, evacuate and call emergency services. Do not reach into a live beam or put yourself at risk to save the machine.
- Do not resume blindly after reset, power loss, interrupted communication or suspected lost steps. Isolate emission, inspect the machine/material, re-establish position/focus/origin and prepare a controlled recovery or a new job.
- A badge expiry locks further commands; it is not a beam interlock and does not itself shut down a running job. Keep an operator at the machine throughout.

## 11. Change back to milling

1. End the job, request output off through the validated program/control path, then **physically isolate the laser supply**. Wait for safe cooldown per its instructions.
2. With power off, disconnect head/fan cables as J Tech instructs and remove the head from its mount. Secure unplugged cables outside the router envelope. J Tech’s Shapeoko article explicitly describes removing the laser for router use; do not leave an exposed head in cutting debris.
3. Have the approved setup procedure restore **$32=0** and verify it. Merely opening the Milling page does not change the controller.
4. Inspect retained mounting parts, router height and dust-shoe clearance. Refit the correct collet/bit with the router unplugged. Re-establish the milling tool reference and stock origin; do not reuse a laser focus/origin as router Z.
5. Follow the [DWP611 guide](dwp611.md) before applying router power.

## 12. Troubleshooting and care

| Symptom | Check / response |
| --- | --- |
| No output | Disable/isolate first. Check key/interlock/reset, external-control mode, matching supply/head connections, CAM scale and manufacturer diagnostics. Do not bypass interlocks or raise driver current. |
| Output on at boot or without a job | Isolate immediately. Investigate control polarity, floating/miswired input and driver mode with qualified help. Do not continue commissioning. |
| Dots, burnt corners or uneven shading | Review M3/M4 choice, laser mode, acceleration/feed behavior and CAM output. Confirm focus/material first; do not assume more power is the answer. |
| Weak/wide engraving | Confirm the correct focus reference, clean optics by the maker’s method, flat stock, fan/cooling and power scale. Do not touch or wipe coatings with arbitrary solvents. |
| Engraving shifted from milling | Check the physical head offset and work origin; look for double-applied offsets and changed mount seating. |
| Alarm/collision near an edge | Stop. Check the laser-specific envelope, homing switch access, mount and harness; the router envelope may be larger. |
| Black webcam | Check scene lighting, camera position and timestamp. Camera brightness is unrelated to beam safety or actual optical power. |

Inspect the lens, fan, harness and mount before each session. Clean only with the head maker’s approved materials and with power isolated. Retain an inspection/commissioning record after any wiring, driver, head, lens, mount, firmware or interlock change; those changes can invalidate the previous setup.

## Sources and commissioning record

- [J Tech Shapeoko 3 installation article](https://jtechphotonics.com/?page_id=3145): mixed-generation mounts, controller connections, cable routing, focus examples, and removal before router use. Consult the matching head/driver manual or J Tech support for the final pinout and focus specification.
- [Grbl 1.1 laser-mode documentation](https://github.com/gnea/grbl/blob/master/doc/markdown/laser_mode.md): $32, PWM scaling, constant M3 versus dynamic M4 and required return to milling mode.
- [LightBurn documentation](https://docs.lightburnsoftware.com/): use the documentation for your installed version and a Grbl-compatible export workflow.

Record: operator/date; identified hardware and manual revisions; verified wiring/voltage/polarity; focus reference/distance; actual laser envelope; controller/CAM S maximum; mode and origin; containment/eyewear/extraction assessment; interlock/physical-stop/default-off tests; first material coupon and result. **Unresolved board identity, wiring or protection means no emission test.**
