// [v1.4.1 · track C] "Driving tonight" in the Food tab's party card, next to the Drinking
// slider because that's where drinkers are set. Drivers stay sober: planParty counts them as
// not drinking (soft drinks, mocktails, the non-drinker share of a Fair split).
import { Stepper } from "./Sheet.jsx";
import { driversOf } from "../lib/rides.js";

export default function DriversField({ party, setParty, plan }) {
  const guests = Math.max(1, plan?.guests ?? party?.guests ?? 1);
  const drivers = plan?.drivers ?? driversOf(party);
  return (
    <div className="field">
      <label>Driving tonight</label>
      <Stepper value={Math.min(drivers, guests)} min={0} max={guests}
        onChange={(v) => setParty((p) => ({ ...p, drivers: v }))} />
    </div>
  );
}
