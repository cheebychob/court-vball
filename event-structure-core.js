(function installCourtEventStructureCore(root) {
  "use strict";

  const text = value => String(value == null ? "" : value);
  const integer = (value, minimum, maximum) => {
    const number = Number(value);
    return Number.isInteger(number) && number >= minimum && number <= maximum ? number : null;
  };
  const uniqueStrings = values => [...new Set((Array.isArray(values) ? values : [])
    .filter(value => typeof value === "string" && value))];
  const pairKey = (left, right) => [text(left), text(right)].sort().join("|");
  const matchupKey = (left, right) => [
    left.slice().sort().join(","),
    right.slice().sort().join(","),
  ].sort().join("~");
  const compareKeys = (left, right) => {
    for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
      const difference = (Number(left[index]) || 0) - (Number(right[index]) || 0);
      if (difference) return difference;
    }
    return 0;
  };
  const hash32 = value => {
    let hash = 2166136261;
    const source = text(value);
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  };
  const combinations = (values, size, limit = 10_000) => {
    const output = [], selected = [];
    const visit = start => {
      if (output.length >= limit) return;
      if (selected.length === size) {
        output.push(selected.map(index => values[index]));
        return;
      }
      for (let index = start; index <= values.length - (size - selected.length); index += 1) {
        selected.push(index);
        visit(index + 1);
        selected.pop();
        if (output.length >= limit) return;
      }
    };
    visit(0);
    return output;
  };
  const countPair = (history, left, right) => history.get(pairKey(left, right)) || 0;
  const rememberPair = (history, left, right) => {
    const key = pairKey(left, right);
    history.set(key, (history.get(key) || 0) + 1);
  };
  const rememberWithin = (history, ids) => {
    for (let left = 0; left < ids.length; left += 1) {
      for (let right = left + 1; right < ids.length; right += 1) {
        rememberPair(history, ids[left], ids[right]);
      }
    }
  };
  const rememberAcross = (history, sideA, sideB) => {
    sideA.forEach(left => sideB.forEach(right => rememberPair(history, left, right)));
  };

  function validateFixedInput(input) {
    const entries = Array.isArray(input?.entries) ? input.entries : [];
    const ids = entries.map(entry => text(entry?.id)).filter(Boolean);
    const settings = input?.settings || {};
    const rounds = integer(settings.rounds ?? settings.standardRounds, 1, 100);
    const courts = integer(settings.courts, 1, 100);
    if (ids.length < 2) return { error: ["not_enough_entries", "Add at least two active teams before generating a schedule."] };
    if (new Set(ids).size !== ids.length) return { error: ["duplicate_entry", "Event team identifiers must be unique."] };
    if (rounds == null || courts == null) return { error: ["invalid_schedule_number", "Choose valid rounds and courts."] };
    return { entries, ids, settings: { ...settings, rounds, standardRounds: rounds, courts } };
  }

  function fixedCandidates(entries) {
    const groups = new Map();
    entries.forEach(entry => {
      const pool = text(entry?.pool);
      const list = groups.get(pool) || [];
      list.push(entry);
      groups.set(pool, list);
    });
    const candidates = [];
    groups.forEach((poolEntries, pool) => {
      for (let left = 0; left < poolEntries.length; left += 1) {
        for (let right = left + 1; right < poolEntries.length; right += 1) {
          candidates.push({
            a: poolEntries[left].id,
            b: poolEntries[right].id,
            pool,
            key: pairKey(poolEntries[left].id, poolEntries[right].id),
          });
        }
      }
    });
    return candidates;
  }

  function assignMakeupBlocks(pairs, courts) {
    const blocks = [];
    pairs.forEach(pair => {
      let placed = false;
      for (const block of blocks) {
        const used = new Set(block.flat());
        if (block.length < courts && pair.every(id => !used.has(id))) {
          block.push(pair);
          placed = true;
          break;
        }
      }
      if (!placed) blocks.push([pair]);
    });
    return blocks;
  }

  function fixedMakeupPairs(ids, counts, candidates, usedPairs) {
    const appearances = [...counts.values()].reduce((sum, value) => sum + value, 0);
    const unused = candidates.filter(candidate => !usedPairs.has(candidate.key));
    const maximumExtraMatches = Math.min(unused.length, ids.length * 2);
    for (let matchCount = 0; matchCount <= maximumExtraMatches; matchCount += 1) {
      const total = appearances + matchCount * 2;
      if (total % ids.length) continue;
      const target = total / ids.length;
      const deficits = new Map(ids.map(id => [id, target - counts.get(id)]));
      if ([...deficits.values()].some(value => value < 0 || value > matchCount)) continue;
      const output = [], selected = new Set();
      const search = index => {
        if (index === matchCount) return [...deficits.values()].every(value => value === 0);
        const remaining = matchCount - index;
        const active = ids.filter(id => deficits.get(id) > 0)
          .sort((left, right) => deficits.get(right) - deficits.get(left) || left.localeCompare(right));
        if (active.some(id => deficits.get(id) > remaining)) return false;
        const first = active[0];
        if (!first) return false;
        const options = unused.filter(candidate =>
          !selected.has(candidate.key)
          && (candidate.a === first || candidate.b === first)
          && deficits.get(candidate.a) > 0
          && deficits.get(candidate.b) > 0)
          .sort((left, right) =>
            deficits.get(right.a) + deficits.get(right.b)
            - deficits.get(left.a) - deficits.get(left.b)
            || left.key.localeCompare(right.key));
        for (const candidate of options) {
          selected.add(candidate.key);
          deficits.set(candidate.a, deficits.get(candidate.a) - 1);
          deficits.set(candidate.b, deficits.get(candidate.b) - 1);
          output.push([candidate.a, candidate.b]);
          if (search(index + 1)) return true;
          output.pop();
          deficits.set(candidate.a, deficits.get(candidate.a) + 1);
          deficits.set(candidate.b, deficits.get(candidate.b) + 1);
          selected.delete(candidate.key);
        }
        return false;
      };
      if (search(0)) return { pairs: output, target };
    }
    return null;
  }

  function generateFixedSchedule(input) {
    const checked = validateFixedInput(input);
    if (checked.error) return { error: checked.error, matches: [] };
    const { entries, ids, settings } = checked;
    const eventId = text(input.eventId) || "event";
    const revision = integer(settings.revision, 1, 1_000_000) || 1;
    const seed = text(settings.seed) || `${eventId}:${revision}`;
    const candidates = fixedCandidates(entries);
    if (!candidates.length) return { error: ["invalid_pools", "Each scheduled pool needs at least two active teams."], matches: [] };
    const counts = new Map(ids.map(id => [id, 0]));
    const sideCounts = new Map(ids.map(id => [id, { A: 0, B: 0 }]));
    const courtCounts = new Map(ids.map(id => [id, Array.from({ length: settings.courts }, () => 0)]));
    const usedPairs = new Set();
    const matches = [];
    const locked = (Array.isArray(input.lockedMatches) ? input.lockedMatches : [])
      .filter(match => ids.includes(match?.a) && ids.includes(match?.b) && match.a !== match.b)
      .map(match => ({
        ...match,
        slot: Math.max(0, Number(match.slot) || 0),
        court: Math.max(0, Number(match.court) || 0),
      }));
    const record = match => {
      counts.set(match.a, counts.get(match.a) + 1);
      counts.set(match.b, counts.get(match.b) + 1);
      usedPairs.add(pairKey(match.a, match.b));
      const aSides = sideCounts.get(match.a), bSides = sideCounts.get(match.b);
      aSides.A += 1;
      bSides.B += 1;
      if (courtCounts.get(match.a)[match.court] != null) courtCounts.get(match.a)[match.court] += 1;
      if (courtCounts.get(match.b)[match.court] != null) courtCounts.get(match.b)[match.court] += 1;
    };
    for (let slot = 0; slot < settings.rounds; slot += 1) {
      const lockedSlot = locked.filter(match => match.slot === slot)
        .sort((left, right) => left.court - right.court);
      const used = new Set();
      lockedSlot.forEach(match => {
        used.add(match.a);
        used.add(match.b);
        matches.push({
          ...match,
          round: slot + 1,
          scheduleBlock: "standard",
          status: match.status || "pending",
        });
        record(match);
      });
      const availableCourts = Array.from({ length: settings.courts }, (_, index) => index)
        .filter(court => !lockedSlot.some(match => match.court === court));
      for (const court of availableCourts) {
        const legal = candidates.filter(candidate =>
          !used.has(candidate.a)
          && !used.has(candidate.b)
          && !usedPairs.has(candidate.key));
        if (!legal.length) break;
        legal.sort((left, right) => compareKeys([
          Math.max(counts.get(left.a), counts.get(left.b)),
          counts.get(left.a) + counts.get(left.b),
          courtCounts.get(left.a)[court] + courtCounts.get(left.b)[court],
          hash32(`${seed}:slot:${slot}:${left.key}`),
        ], [
          Math.max(counts.get(right.a), counts.get(right.b)),
          counts.get(right.a) + counts.get(right.b),
          courtCounts.get(right.a)[court] + courtCounts.get(right.b)[court],
          hash32(`${seed}:slot:${slot}:${right.key}`),
        ]));
        const chosen = legal[0];
        const keepSpread = Math.abs((sideCounts.get(chosen.a).A + 1) - sideCounts.get(chosen.a).B)
          + Math.abs(sideCounts.get(chosen.b).A - (sideCounts.get(chosen.b).B + 1));
        const flipSpread = Math.abs((sideCounts.get(chosen.b).A + 1) - sideCounts.get(chosen.b).B)
          + Math.abs(sideCounts.get(chosen.a).A - (sideCounts.get(chosen.a).B + 1));
        const flipped = flipSpread < keepSpread
          || (flipSpread === keepSpread && hash32(`${seed}:side:${slot}:${chosen.key}`) % 2 === 1);
        const match = {
          id: `${eventId}-v${revision}-r${slot + 1}-c${court + 1}`,
          a: flipped ? chosen.b : chosen.a,
          b: flipped ? chosen.a : chosen.b,
          pool: chosen.pool,
          slot,
          round: slot + 1,
          court,
          scheduleBlock: "standard",
          status: "pending",
        };
        used.add(chosen.a);
        used.add(chosen.b);
        matches.push(match);
        record(match);
      }
    }
    let makeupTarget = null;
    if (input.includeMakeups !== false && settings.fairnessPolicy === "equalGames") {
      const plan = fixedMakeupPairs(ids, counts, candidates, usedPairs);
      if (!plan) {
        return {
          error: ["fairness_unavailable", "Equal games would require a repeated pool opponent with this match list."],
          matches,
        };
      }
      makeupTarget = plan.target;
      const blocks = assignMakeupBlocks(plan.pairs, settings.courts);
      let makeupIndex = 0;
      blocks.forEach((block, blockIndex) => block.forEach((pair, court) => {
        makeupIndex += 1;
        const candidate = candidates.find(value => value.key === pairKey(pair[0], pair[1]));
        matches.push({
          id: `${eventId}-v${revision}-makeup-${makeupIndex}`,
          a: pair[0],
          b: pair[1],
          pool: candidate?.pool || "",
          slot: settings.rounds + blockIndex,
          round: settings.rounds + blockIndex + 1,
          court,
          scheduleBlock: "makeup",
          status: "pending",
          label: "Balances games played",
          makeupIndex,
          makeupBlock: blockIndex + 1,
        });
        counts.set(pair[0], counts.get(pair[0]) + 1);
        counts.set(pair[1], counts.get(pair[1]) + 1);
      }));
    }
    const values = [...counts.values()];
    return {
      matches,
      audit: {
        gamesMin: Math.min(...values),
        gamesMax: Math.max(...values),
        gameDifference: Math.max(...values) - Math.min(...values),
        duplicateOpponentCount: matches.length - new Set(matches.map(match => pairKey(match.a, match.b))).size,
        targetGames: makeupTarget,
      },
    };
  }

  function validateRotatingInput(input) {
    const entries = Array.isArray(input?.entries) ? input.entries : [];
    const settings = input?.settings || {};
    const entrySize = integer(settings.entrySize, 1, 20);
    const teamSize = integer(settings.teamSize, 1, 20);
    const rounds = integer(settings.rounds ?? settings.standardRounds, 1, 100);
    const courts = integer(settings.courts, 1, 100);
    if (entrySize == null || teamSize == null || teamSize % entrySize !== 0) {
      return { error: ["invalid_rotation_sizes", "Team size must be a whole multiple of rotating entry size."] };
    }
    const perSide = teamSize / entrySize, perMatch = perSide * 2;
    if (perSide < 2) return { error: ["invalid_rotation_sizes", "Use fixed teams when one entry fills an entire side."] };
    if (rounds == null || courts == null) return { error: ["invalid_schedule_number", "Choose valid rounds and courts."] };
    if (entries.length < perMatch) {
      return { error: ["not_enough_entries", `Add at least ${perMatch} active rotating entries before generating a schedule.`] };
    }
    const ids = entries.map(entry => text(entry?.id)).filter(Boolean);
    if (ids.length !== entries.length || new Set(ids).size !== ids.length) {
      return { error: ["duplicate_entry", "Rotating entry identifiers must be unique."] };
    }
    if (entries.some(entry => uniqueStrings(entry?.players).length !== entrySize)) {
      return { error: ["invalid_entry_size", `Every active rotating entry must contain exactly ${entrySize} participant${entrySize === 1 ? "" : "s"}.`] };
    }
    const playerIds = entries.flatMap(entry => uniqueStrings(entry.players));
    if (new Set(playerIds).size !== playerIds.length) {
      return { error: ["duplicate_participant", "A participant cannot belong to more than one rotating entry."] };
    }
    return {
      entries,
      ids,
      settings: { ...settings, entrySize, teamSize, rounds, standardRounds: rounds, courts },
      perSide,
      perMatch,
    };
  }

  function bestRotatingSides(selected, perSide, histories, strengths, seed) {
    let best = null;
    const candidates = combinations(selected, perSide, 5000)
      .filter(side => side.includes(selected[0]));
    candidates.forEach(sideA => {
      const setA = new Set(sideA), sideB = selected.filter(id => !setA.has(id));
      let opponentPairs = 0, opponentLoad = 0, teammatePairs = 0, teammateLoad = 0;
      combinations(sideA, 2).concat(combinations(sideB, 2)).forEach(([left, right]) => {
        const count = countPair(histories.teammates, left, right);
        if (count) teammatePairs += 1;
        teammateLoad += count;
      });
      sideA.forEach(left => sideB.forEach(right => {
        const count = countPair(histories.opponents, left, right);
        if (count) opponentPairs += 1;
        opponentLoad += count;
      }));
      const full = matchupKey(sideA, sideB);
      const strengthGap = Math.abs(
        sideA.reduce((sum, id) => sum + (strengths.get(id) || 0), 0)
        - sideB.reduce((sum, id) => sum + (strengths.get(id) || 0), 0),
      );
      const score = [
        opponentPairs,
        opponentLoad,
        histories.exact.get(full) || 0,
        teammatePairs,
        teammateLoad,
        Math.round(strengthGap * 1000),
        hash32(`${seed}:${full}`),
      ];
      if (!best || compareKeys(score, best.score) < 0) {
        best = { sideA: sideA.slice(), sideB, full, score };
      }
    });
    return best;
  }

  function rotatingAudit(ids, matches, rounds) {
    const games = new Map(ids.map(id => [id, 0]));
    const teammates = new Map(), opponents = new Map(), exact = new Map();
    const roundConflicts = [];
    const byRound = new Map();
    matches.forEach(match => {
      const playing = [...match.sideAEntryIds, ...match.sideBEntryIds];
      const seen = byRound.get(match.round) || new Set();
      playing.forEach(id => {
        if (seen.has(id)) roundConflicts.push({ round: match.round, entryId: id, matchId: match.id });
        seen.add(id);
        if (games.has(id)) games.set(id, games.get(id) + 1);
      });
      byRound.set(match.round, seen);
      rememberWithin(teammates, match.sideAEntryIds);
      rememberWithin(teammates, match.sideBEntryIds);
      rememberAcross(opponents, match.sideAEntryIds, match.sideBEntryIds);
      const full = matchupKey(match.sideAEntryIds, match.sideBEntryIds);
      exact.set(full, (exact.get(full) || 0) + 1);
    });
    const values = [...games.values()];
    const repeatedTeammates = [...teammates.values()].reduce((sum, value) => sum + Math.max(0, value - 1), 0);
    const repeatedOpponents = [...opponents.values()].reduce((sum, value) => sum + Math.max(0, value - 1), 0);
    const exactMatchupRepeats = [...exact.values()].reduce((sum, value) => sum + Math.max(0, value - 1), 0);
    const totalOpponentAssignments = [...opponents.values()].reduce((sum, value) => sum + value, 0);
    const maximumUniquePairs = ids.length * (ids.length - 1) / 2;
    const unavoidableOpponentRepeats = Math.max(0, totalOpponentAssignments - maximumUniquePairs);
    const byes = ids.map(id => Math.max(0, rounds - matches
      .filter(match => match.scheduleBlock === "standard" && [...match.sideAEntryIds, ...match.sideBEntryIds].includes(id)).length));
    return {
      gamesMin: Math.min(...values),
      gamesMax: Math.max(...values),
      gameDifference: Math.max(...values) - Math.min(...values),
      byesMin: Math.min(...byes),
      byesMax: Math.max(...byes),
      repeatedTeammates,
      repeatedOpponents,
      exactMatchupRepeats,
      unavoidableOpponentRepeats,
      avoidableOpponentRepeats: Math.max(0, repeatedOpponents - unavoidableOpponentRepeats),
      roundEntryConflicts: roundConflicts,
      invalidRounds: roundConflicts.length,
    };
  }

  function composeDeficitGroups(ids, counts, groupSize) {
    const appearances = [...counts.values()].reduce((sum, value) => sum + value, 0);
    const cycle = Math.max(1, ids.length * 2);
    for (let matchCount = 0; matchCount <= cycle; matchCount += 1) {
      const total = appearances + matchCount * groupSize;
      if (total % ids.length) continue;
      const target = total / ids.length;
      const deficits = new Map(ids.map(id => [id, target - counts.get(id)]));
      if ([...deficits.values()].some(value => value < 0 || value > matchCount)) continue;
      const groups = [];
      for (let index = 0; index < matchCount; index += 1) {
        const remaining = matchCount - index;
        const candidates = ids.filter(id => deficits.get(id) > 0)
          .sort((left, right) => deficits.get(right) - deficits.get(left) || left.localeCompare(right));
        if (candidates.length < groupSize || candidates.some(id => deficits.get(id) > remaining)) break;
        const group = candidates.slice(0, groupSize);
        group.forEach(id => deficits.set(id, deficits.get(id) - 1));
        groups.push(group);
      }
      if (groups.length === matchCount && [...deficits.values()].every(value => value === 0)) {
        return { groups, target };
      }
    }
    return null;
  }

  function generateRotatingCandidate(input, checked, candidateIndex) {
    const { entries, ids, settings, perSide, perMatch } = checked;
    const eventId = text(input.eventId) || "event";
    const revision = integer(settings.revision, 1, 1_000_000) || 1;
    const seed = `${text(settings.seed) || eventId}:${revision}:candidate:${candidateIndex}`;
    const strengths = new Map(entries.map(entry => [
      entry.id,
      Number.isFinite(Number(entry.seedStrength))
        ? Number(entry.seedStrength)
        : Number.isFinite(Number(entry.manualSeed)) ? -Number(entry.manualSeed) : 0,
    ]));
    const counts = new Map(ids.map(id => [id, 0]));
    const byes = new Map(ids.map(id => [id, 0]));
    const histories = { teammates: new Map(), opponents: new Map(), exact: new Map() };
    const courtCounts = new Map(ids.map(id => [id, Array.from({ length: settings.courts }, () => 0)]));
    const sideCounts = new Map(ids.map(id => [id, { A: 0, B: 0 }]));
    const matches = [];
    const record = match => {
      const playing = [...match.sideAEntryIds, ...match.sideBEntryIds];
      playing.forEach(id => {
        counts.set(id, counts.get(id) + 1);
        const courtIndex = Math.max(0, Number(match.court) - 1);
        if (courtCounts.get(id)[courtIndex] != null) courtCounts.get(id)[courtIndex] += 1;
      });
      match.sideAEntryIds.forEach(id => { sideCounts.get(id).A += 1; });
      match.sideBEntryIds.forEach(id => { sideCounts.get(id).B += 1; });
      rememberWithin(histories.teammates, match.sideAEntryIds);
      rememberWithin(histories.teammates, match.sideBEntryIds);
      rememberAcross(histories.opponents, match.sideAEntryIds, match.sideBEntryIds);
      const full = matchupKey(match.sideAEntryIds, match.sideBEntryIds);
      histories.exact.set(full, (histories.exact.get(full) || 0) + 1);
    };
    const locked = (Array.isArray(input.lockedMatches) ? input.lockedMatches : [])
      .map(match => ({
        ...match,
        sideAEntryIds: uniqueStrings(match?.sideAEntryIds),
        sideBEntryIds: uniqueStrings(match?.sideBEntryIds),
      }))
      .filter(match =>
        match.sideAEntryIds.length === perSide
        && match.sideBEntryIds.length === perSide
        && [...match.sideAEntryIds, ...match.sideBEntryIds].every(id => ids.includes(id)));
    const lockedRounds = [...new Set(locked.map(match => Number(match.round) || Number(match.slot) + 1))]
      .sort((left, right) => left - right);
    lockedRounds.forEach(round => {
      const playing = new Set();
      locked.filter(match => (Number(match.round) || Number(match.slot) + 1) === round)
        .sort((left, right) => Number(left.court) - Number(right.court))
        .forEach(match => {
          const copy = {
            ...match,
            round,
            court: Math.max(1, Number(match.court) || 1),
            scheduleBlock: "standard",
            status: match.status || "pending",
          };
          [...copy.sideAEntryIds, ...copy.sideBEntryIds].forEach(id => playing.add(id));
          matches.push(copy);
          record(copy);
        });
      ids.filter(id => !playing.has(id)).forEach(id => byes.set(id, byes.get(id) + 1));
    });
    const firstRound = lockedRounds.length ? Math.max(...lockedRounds) + 1 : 1;
    for (let round = firstRound; round <= settings.rounds; round += 1) {
      const ordered = ids.slice().sort((left, right) =>
        counts.get(left) - counts.get(right)
        || byes.get(right) - byes.get(left)
        || hash32(`${seed}:round:${round}:${left}`) - hash32(`${seed}:round:${round}:${right}`));
      const matchCount = Math.min(settings.courts, Math.floor(ids.length / perMatch));
      const playing = ordered.slice(0, matchCount * perMatch);
      const sitting = ordered.slice(matchCount * perMatch);
      const remaining = playing.slice(), groups = [];
      while (remaining.length >= perMatch) {
        const group = [remaining.shift()];
        while (group.length < perMatch) {
          let bestIndex = 0, bestScore = null;
          remaining.forEach((candidate, index) => {
            const meetingLoad = group.reduce((sum, member) =>
              sum
              + countPair(histories.teammates, candidate, member) * 4
              + countPair(histories.opponents, candidate, member) * 12, 0);
            const score = [meetingLoad, hash32(`${seed}:group:${round}:${candidate}`)];
            if (!bestScore || compareKeys(score, bestScore) < 0) {
              bestScore = score;
              bestIndex = index;
            }
          });
          group.push(remaining.splice(bestIndex, 1)[0]);
        }
        groups.push(group);
      }
      const rawMatches = groups.map((group, index) => {
        const sides = bestRotatingSides(group, perSide, histories, strengths, `${seed}:round:${round}:group:${index}`);
        return sides && {
          sideAEntryIds: sides.sideA,
          sideBEntryIds: sides.sideB,
        };
      }).filter(Boolean);
      const availableCourts = Array.from({ length: settings.courts }, (_, index) => index + 1);
      rawMatches.forEach((raw, index) => {
        const court = availableCourts.slice().sort((left, right) => {
          const leftLoad = [...raw.sideAEntryIds, ...raw.sideBEntryIds]
            .reduce((sum, id) => sum + courtCounts.get(id)[left - 1], 0);
          const rightLoad = [...raw.sideAEntryIds, ...raw.sideBEntryIds]
            .reduce((sum, id) => sum + courtCounts.get(id)[right - 1], 0);
          return leftLoad - rightLoad || left - right;
        })[0];
        availableCourts.splice(availableCourts.indexOf(court), 1);
        const keepSpread = raw.sideAEntryIds.reduce((sum, id) =>
          sum + Math.abs((sideCounts.get(id).A + 1) - sideCounts.get(id).B), 0)
          + raw.sideBEntryIds.reduce((sum, id) =>
            sum + Math.abs(sideCounts.get(id).A - (sideCounts.get(id).B + 1)), 0);
        const flipSpread = raw.sideBEntryIds.reduce((sum, id) =>
          sum + Math.abs((sideCounts.get(id).A + 1) - sideCounts.get(id).B), 0)
          + raw.sideAEntryIds.reduce((sum, id) =>
            sum + Math.abs(sideCounts.get(id).A - (sideCounts.get(id).B + 1)), 0);
        const sideAEntryIds = flipSpread < keepSpread ? raw.sideBEntryIds : raw.sideAEntryIds;
        const sideBEntryIds = flipSpread < keepSpread ? raw.sideAEntryIds : raw.sideBEntryIds;
        const match = {
          id: `${eventId}-v${revision}-r${round}-c${court}`,
          round,
          court,
          sideAEntryIds,
          sideBEntryIds,
          scheduleBlock: "standard",
          status: "pending",
        };
        matches.push(match);
        record(match);
      });
      sitting.forEach(id => byes.set(id, byes.get(id) + 1));
    }
    const preserved = (Array.isArray(input.preservedMatches) ? input.preservedMatches : [])
      .filter(match => match && match.scheduleBlock !== "standard")
      .map(match => ({
        ...match,
        sideAEntryIds: uniqueStrings(match.sideAEntryIds),
        sideBEntryIds: uniqueStrings(match.sideBEntryIds),
      }));
    preserved.forEach(match => {
      matches.push(match);
      record(match);
    });
    if (input.includeMakeups !== false && settings.fairnessPolicy === "equalGames") {
      const plan = composeDeficitGroups(ids, counts, perMatch);
      if (!plan) {
        return {
          error: ["fairness_unavailable", "Court could not compose every required rotating makeup match."],
          matches,
        };
      }
      const blocks = assignMakeupBlocks(plan.groups, settings.courts);
      let makeupIndex = 0;
      blocks.forEach((block, blockIndex) => block.forEach((group, courtIndex) => {
        makeupIndex += 1;
        const sides = bestRotatingSides(
          group,
          perSide,
          histories,
          strengths,
          `${seed}:makeup:${makeupIndex}`,
        );
        if (!sides) return;
        const match = {
          id: `${eventId}-v${revision}-makeup-${makeupIndex}`,
          round: settings.rounds + blockIndex + 1,
          court: courtIndex + 1,
          sideAEntryIds: sides.sideA,
          sideBEntryIds: sides.sideB,
          scheduleBlock: "makeup",
          status: "pending",
          makeupIndex,
          makeupBlock: blockIndex + 1,
          label: "Balances games played",
        };
        matches.push(match);
        record(match);
      }));
    }
    const audit = rotatingAudit(ids, matches, settings.rounds);
    return {
      matches,
      initialSeeds: Object.fromEntries(entries.slice()
        .sort((left, right) =>
          (strengths.get(right.id) || 0) - (strengths.get(left.id) || 0)
          || left.id.localeCompare(right.id))
        .map((entry, index) => [entry.id, index + 1])),
      audit,
    };
  }

  function generateRotatingSchedule(input) {
    const checked = validateRotatingInput(input);
    if (checked.error) return { error: checked.error, matches: [] };
    const candidates = [];
    for (let index = 0; index < 32; index += 1) {
      const result = generateRotatingCandidate(input, checked, index);
      if (!result.error) candidates.push(result);
    }
    if (!candidates.length) return generateRotatingCandidate(input, checked, 0);
    candidates.sort((left, right) => compareKeys([
      left.audit.invalidRounds,
      left.audit.gameDifference,
      left.audit.avoidableOpponentRepeats,
      left.audit.repeatedOpponents,
      left.audit.exactMatchupRepeats,
      left.audit.repeatedTeammates,
    ], [
      right.audit.invalidRounds,
      right.audit.gameDifference,
      right.audit.avoidableOpponentRepeats,
      right.audit.repeatedOpponents,
      right.audit.exactMatchupRepeats,
      right.audit.repeatedTeammates,
    ]) || JSON.stringify(left.matches).localeCompare(JSON.stringify(right.matches)));
    const chosen = candidates[0];
    if (chosen.audit.avoidableOpponentRepeats > 0) {
      return {
        ...chosen,
        error: [
          "avoidable_opponent_repeat",
          `Court could not build these rotating rounds without ${chosen.audit.avoidableOpponentRepeats} avoidable opposing-entry repeat${chosen.audit.avoidableOpponentRepeats === 1 ? "" : "s"}.`,
        ],
      };
    }
    return chosen;
  }

  function bracketSeedOrder(size) {
    let order = [0];
    while (order.length < size) {
      const length = order.length;
      order = order.flatMap(value => [value, length * 2 - 1 - value]);
    }
    return order;
  }

  root.CourtEventStructureCore = Object.freeze({
    version: 1,
    bracketSeedOrder,
    generateFixedSchedule,
    generateRotatingSchedule,
    validateFixedInput,
    validateRotatingInput,
  });
})(globalThis);
