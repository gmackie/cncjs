# BitZero V2 and BitSetter setup and use

**Shapeoko 3 XL · DWP611 · connected BitZero V2 · installed BitSetter**

The owner confirmed the BitZero is **V2 and already connected**. Both accessories still need physical commissioning. No homing, probing, offsets, or machine parameters were changed while preparing this guide. The 2020 saved macros are not approved for use.

## 1. What each accessory does

- **BitZero V2** locates the stock corner (X/Y/Z) or a stock surface (Z only). Its circular bore is part of a V2-specific probing procedure. Do not use a V1 edge-probing routine or generic touch-plate defaults.
- **BitSetter** is a fixed tool-length reference. It lets a measured cutter replace a measured probing pin or another cutter without losing the established stock Z zero. It does not locate the stock corner.
- **Homing** establishes the machine coordinates needed to revisit BitSetter. A successful probe does not substitute for homing.

For first commissioning, use one tool per G-code file. Automated multi-tool pause/change/resume remains unverified.

## 2. Inspect the installed hardware with power isolated

Unplug the DWP611 and disable/disconnect laser power. Switch off machine power before opening the electronics enclosure or changing connections. Do not move cables with electronics powered.

Check that BitSetter is firmly mounted and its button moves freely. Check that BitZero's locating edges and insulated bottom are clean and undamaged. Keep both cables out of the cutting and travel envelope.

Carbide's Shapeoko BitZero V2 manual explains using the **probe adapter PCB supplied with BitSetter** when both accessories share the applicable controller connection. Its ports are labeled BitZero/Touch Probe, BitSetter/Tool Probe, and To Carbide Motion. The main-board connection depends on the board revision. Preserve the existing wiring until its adapter and labels are positively identified; do not join wires based on color alone or use a generic passive splitter.

Source: [official Shapeoko BitZero V2 manual, installation pages 3–7](https://guides.carbide3d.com/files/pdf/BitZero_V2_Shapeoko.pdf). Board revisions in that manual have different connection instructions.

## 3. Verify the probe signal before allowing probe motion

With the router unplugged and laser power off, an operator at the machine must first confirm readiness for controller connection; opening serial may reset Grbl. Only one sender may connect. Keep the machine restricted until commissioning is complete; do not bypass badge authorization to gain control.

With both probes untouched, inspect the controller's probe input. For Grbl 1.1 status reports, an active probe is indicated by **P** in the **Pn** field; no P means inactive. A recent status report is required. An accessory LED alone does not prove that the controller sees the input.

1. Attach BitZero's magnetic grounding lead to the collet nut or conductive probing pin, as described by Carbide. With no axes moving, carefully bring the probe body into contact with the stationary conductive pin/cutter, keeping fingers clear of its edges: its LED should turn red, and the controller probe input should become active.
2. Separate them: verify the input returns inactive. Repeat several times.
3. Place BitZero where it cannot contact the grounded tool or create an unintended contact. Manually depress BitSetter's button: verify the controller input becomes active; release it and verify it clears.
4. Test the two accessories independently. With a shared input, the controller cannot tell which accessory caused contact. Neither may already be triggered when a cycle starts.

Stop if the indication is reversed, stuck, missing, intermittent, or changes when cables move. Investigate wiring, grounding and configuration before motion. Do not change Grbl's probe-invert setting simply to hide an unexplained signal.

## 4. Establish the machine and BitSetter location

This requires supervised homing and jogging with the operator ready to stop motion. The saved Y travel is **850 mm**, unverified for this shallow Shapeoko 3 XL. Do not use it as evidence of a safe travel envelope.

The legacy Initial Tool Set macro contains these **unverified historical values, not setup instructions**:

| Parameter | Saved value | Required verification |
| --- | --- | --- |
| BitSetter machine X | −33 mm | Actual button center after homing |
| BitSetter machine Y | −373.5 mm | Actual button center after homing |
| Initial approach machine Z | −30 mm | Clearance with the installed pin/tool |
| Travel clearance machine Z | −20 mm | Entire route, fixtures, stock, tool and Z limits |
| Probe search | 80 mm at 200 mm/min | Replace with a measured, bounded search appropriate to the approach |

Record actual machine coordinates over the button, a validated route/clearance height, an approach position and a bounded contact distance. Evaluate the longest and shortest intended tools. A negative machine Z value is not automatically safe. Do not rapid diagonally through fixtures or assume work zero is a safe return destination.

## 5. BitZero V2 corner setup

You currently have **no probing pin**. A clean, conductive, intact flat-end cutter can be used after verifying electrical contact; BitSetter normally measures the installed cutter. For BitZero V2, flutes and cutter orientation can affect contact and repeatability. A smooth probing pin is preferred for accurate X/Y work. Avoid pointed/V-bits, damaged tools and coatings that prevent electrical contact. Do not assume every bit is suitable.

Use a correctly fitted **DWP611-compatible ⅛-inch precision collet** for a ⅛-inch shank; never clamp it in the stock ¼-inch collet. Keep the router unplugged. Attach the magnetic lead to the collet nut and check contact/release with the actual cutter without moving the axes. Keep fingers clear of sharp edges; do not push on a cutting edge. The pin placement instructions below also describe the cutter starting position, but do not eliminate the need to validate the V2 routine and repeatability.

For Carbide's lower-left XYZ corner operation (manual pages 10–12):

1. Secure the stock and confirm CAM uses that stock corner and top surface as its origin. Confirm the intended work coordinate system, normally G54.
2. Seat BitZero V2 on the lower-left stock corner with its locating edges overhanging and pressed against the stock edges. Do not rock it on chips or rounded edges.
3. With a commissioned machine, position the pin tip just inside the circular bore, following the manufacturer's starting-position illustration. This is not the same starting point as a V1 edge routine.
4. Attach the grounding lead and verify contact/release indication before the cycle.
5. Run only a reviewed V2-specific XYZ routine with the correct geometry and clearances. The factory manual's button instructions refer to **Carbide Motion**; they do not mean that selecting a CNCjs page configures an equivalent routine.
6. Verify the resulting work zero using a controlled clearance check before cutting. Remove the BitZero and grounding lead from the work envelope.

**Current CNCjs status:** no dedicated, commissioned V2 corner routine has been installed. Do not paste a guessed routine or substitute generic touch-plate thickness values. Its cycle and offsets must be validated before first use.

For Z-only probing, the official manual uses different placement: rest the probe on the stock surface and start above its top surface. Do not reuse the corner placement/offset assumptions for Z-only.

## 6. Combine stock zero and tool-length measurement

The first tool is often the smooth probing pin; the cutting tool replaces it afterward. A correct combined workflow must preserve the stock origin through that change:

1. Home using the commissioned procedure and establish a valid BitSetter reference for the installed pin/tool.
2. Probe the stock with BitZero V2 using that same measured pin/tool.
3. Before cutting, change to the cutter through the commissioned tool-change workflow and measure it with BitSetter.
4. Apply the measured tool-length difference once, with the documented sign and offset method. Preserve stock X/Y and the stock surface datum.
5. Verify the cutter's stock Z against an independent reference with the spindle off, then remove the probes/grounding lead from the cutting envelope.
6. Set DWP611 speed and power manually only when ready; Start is a separate action.

The tool-length reference must use a coordinate convention unaffected by setting stock work zero, or explicitly reconcile the reference when work offsets change. Do not mix G43.1 tool offsets and G10 work-offset corrections without a designed and tested convention. Restart/reset, loss of homing, a moved router body, missed steps or lost reference invalidates automatic compensation until re-established.

A repeatability test should measure the same pin twice, swap to a cutter and measure it, then return to the original pin and check the original stock datum again. Record observed error against the tolerances required by the job; do not invent a passed calibration from software success messages.

## 7. Why the saved macros need replacement

The saved Initial Tool Set and New Tool Set routines date from November 2020. Read-only inspection found:

- Initial Tool Set stores `TOOL_REFERENCE = posz`, a **work-coordinate** value. Setting stock Z afterward with BitZero changes that coordinate frame. New Tool Set subsequently uses that saved number with `G10 L20`, so that sequence can apply an incorrect stock Z correction.
- New Tool Set declares local clearance/search variables but its moves use the globals created by Initial Tool Set. Those globals can be missing after restart or differ from the apparent local settings.
- The location and long probe search have not been physically validated. Both routines return to work X0/Y0 automatically.
- The routines restore saved spindle/coolant modes. M5 does not switch off a manually powered DWP611, and restoring M3/M4 could energize a future connected output. Probe preparation must require actual tool-power isolation.

Do not run these macros merely because they appear in the UI. They were preserved for inspection, not certified as safe. A replacement needs bounded motion, fresh probe-state checks, a consistent reference/offset model, explicit failure handling and supervised commissioning.

## 8. Commissioning record and next step

Track this work as **GMA-728**. Keep it open until both input tests, homing/route checks, the V2 routine, BitSetter reference compensation and the pin–cutter–pin repeatability test are recorded. Guide installation is preparation, not completed physical setup.

For the next supervised session, have the machine accessible, stock/fixtures clear for initial checks, DWP611 unplugged, laser power off, a suitable conductive flat-end cutter (or smooth probing pin) and correct ⅛-inch collet available, and a way to stop the machine immediately. We begin with connection and stationary input checks; homing and each first probing move are separate steps.

Related: [DWP611 installation and milling](dwp611.md) · [J Tech 7 W laser](jtech-7w.md). Do not run router probing routines with the laser head as the tool.
