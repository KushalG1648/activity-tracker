import { r2 } from '../api';

export function calcBadminton(equipment, recoveryTotals, form) {
  if (!equipment || !recoveryTotals) return null;
  const shuttle = equipment.find(e => e.name === 'shuttle');
  const racket  = equipment.find(e => e.name === 'racket');
  const shoe    = equipment.find(e => e.name === 'shoe');
  if (!shuttle || !racket || !shoe) return null;

  const D = (parseFloat(form.duration_minutes) || 60) / 60;
  const N = parseInt(form.num_other_players) || 0;
  const C = parseFloat(form.court_cost)  || 0;
  const P = parseFloat(form.transport_cost) || 0;

  const shuttle_cost  = r2((shuttle.total_cost / shuttle.units_per_pack) / shuttle.hours_per_unit * D);
  const r_rem         = Math.max(0, racket.total_cost - (recoveryTotals.total_racket || 0));
  const racket_charge = r_rem > 0 ? Math.min(r2(racket.total_cost / racket.amort_sessions), r_rem) : 0;
  const s_rem         = Math.max(0, shoe.total_cost - (recoveryTotals.total_shoe || 0));
  const shoe_charge   = s_rem > 0 ? Math.min(r2(shoe.total_cost / shoe.amort_sessions), s_rem) : 0;

  const session_total = r2(C + P + shuttle_cost + racket_charge + shoe_charge);

  return {
    shuttle_cost,
    racket_charge: r2(racket_charge),
    shoe_charge:   r2(shoe_charge),
    session_total,
    per_player_fair: r2(session_total / (N + 1)),
    per_player_adv:  N > 0 ? r2(session_total / N) : null,
  };
}

export function calcCricket(equipment, recoveryTotals, form) {
  if (!equipment || !recoveryTotals) return null;
  const ball = equipment.find(e => e.name === 'ball');
  const bat  = equipment.find(e => e.name === 'bat');
  if (!ball || !bat) return null;

  const D = (parseFloat(form.duration_minutes) || 60) / 60;
  const N = parseInt(form.num_players) || 0;
  const G = parseFloat(form.ground_cost)    || 0;
  const P = parseFloat(form.transport_cost) || 0;

  const ball_cost = r2((ball.total_cost / ball.units_per_pack) / ball.hours_per_unit * D);
  const bat_rem   = Math.max(0, bat.total_cost - (recoveryTotals.total_bat || 0));
  const bat_charge = bat_rem > 0 ? Math.min(r2(bat.total_cost / bat.amort_sessions), bat_rem) : 0;

  const session_total = r2(G + P + ball_cost + bat_charge);

  return {
    ball_cost,
    bat_charge: r2(bat_charge),
    session_total,
    per_player_fair: N >= 0 ? r2(session_total / (N + 1)) : null,
    per_player_adv:  N > 0  ? r2(session_total / N) : null,
  };
}

export function calcGeneric(form) {
  const entry_fee    = parseFloat(form.entry_fee)      || 0;
  const transport    = parseFloat(form.transport_cost) || 0;
  return { session_total: r2(entry_fee + transport) };
}

export function calcPreview(slug, equipment, recoveryTotals, form) {
  if (slug === 'badminton') return calcBadminton(equipment, recoveryTotals, form);
  if (slug === 'cricket')   return calcCricket(equipment, recoveryTotals, form);
  return calcGeneric(form);
}
