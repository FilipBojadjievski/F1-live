import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchPodiums, fetchRaces } from "./jolpica";

const racesJson = {
  MRData: {
    RaceTable: {
      Races: [
        {
          round: "1",
          raceName: "Australian Grand Prix",
          date: "2026-03-08",
          Circuit: {
            circuitId: "albert_park",
            circuitName: "Albert Park Grand Prix Circuit",
          },
        },
        {
          round: "2",
          raceName: "Chinese Grand Prix",
          date: "2026-03-15",
          Circuit: {
            circuitId: "shanghai",
            circuitName: "Shanghai International Circuit",
          },
        },
      ],
    },
  },
};

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

it("fetchRaces returns the season calendar in round order", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => racesJson })),
  );

  const races = await fetchRaces();

  expect(races).toHaveLength(2);
  expect(races[0]).toMatchObject({
    round: "1",
    raceName: "Australian Grand Prix",
    date: "2026-03-08",
    Circuit: { circuitName: "Albert Park Grand Prix Circuit" },
  });
  expect(races[1].raceName).toBe("Chinese Grand Prix");
});

// /results/{pos}/ responses: one Result per race, at that finishing position.
function positionJson(
  pos: string,
  byRound: Record<string, [string, string, string]>,
) {
  return {
    MRData: {
      RaceTable: {
        Races: Object.entries(byRound).map(([round, [code, family, team]]) => ({
          round,
          raceName: `Round ${round} GP`,
          date: "2026-03-08",
          Circuit: { circuitId: "c", circuitName: "C" },
          Results: [
            {
              position: pos,
              Driver: {
                driverId: family.toLowerCase(),
                code,
                givenName: "X",
                familyName: family,
              },
              Constructor: { constructorId: team, name: team },
            },
          ],
        })),
      },
    },
  };
}

it("fetchPodiums merges /results/1..3 into per-round podiums sorted P1→P3", async () => {
  const responses: Record<string, unknown> = {
    "/results/1/": positionJson("1", {
      "1": ["NOR", "Norris", "mclaren"],
      "2": ["VER", "Verstappen", "red_bull"],
    }),
    "/results/2/": positionJson("2", {
      "1": ["VER", "Verstappen", "red_bull"],
      "2": ["NOR", "Norris", "mclaren"],
    }),
    "/results/3/": positionJson("3", {
      "1": ["ANT", "Antonelli", "mercedes"],
      "2": ["LEC", "Leclerc", "ferrari"],
    }),
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown) => {
      const path = Object.keys(responses).find((p) => String(url).includes(p))!;
      return { ok: true, json: async () => responses[path] };
    }),
  );

  const podiums = await fetchPodiums();

  expect(Object.keys(podiums).sort()).toEqual(["1", "2"]);
  expect(podiums["1"].map((r) => r.Driver.code)).toEqual(["NOR", "VER", "ANT"]);
  expect(podiums["2"].map((r) => r.Driver.code)).toEqual(["VER", "NOR", "LEC"]);
  expect(podiums["1"][0].Constructor.constructorId).toBe("mclaren");
});
