/**
 * ESPN API Router - Integration with TRPC
 * Add this router to your server/routers.ts
 * 
 * Usage in routers.ts:
 * import { espnRouter } from "./_core/espnApi";
 * export const appRouter = router({
 *   // ... other routers
 *   espn: espnRouter,
 * });
 */

import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import {
  getScoreboard,
  getNflScoreboard,
  getNbaScoreboard,
  getMlbScoreboard,
  getNhlScoreboard,
  getSoccerScoreboard,
  getTeams,
  getTeamDetail,
  getTeamRoster,
  getTeamSchedule,
  getTeamInjuries,
  getStandings,
  getAthlete,
  getAthleteGameLog,
  getAthleteStats,
  getAthleteNews,
  getGameOdds,
  getGamePredictor,
  getGameSummary,
  getPlayByPlay,
  getSportNews,
  getQbr,
  getPowerIndex,
  getLeaders,
  searchEspn,
  getAthleteHeadshotUrl,
  getTeamLogoUrl,
} from "./espnApi";

export const espnRouter = router({
  // ==================== SCOREBOARD ====================
  scoreboard: router({
    // Generic scoreboard
    getByLeague: publicProcedure
      .input(
        z.object({
          sport: z.string().default("football"),
          league: z.string().default("nfl"),
          dates: z.string().optional(),
          week: z.number().optional(),
          limit: z.number().optional(),
        })
      )
      .query(async ({ input }) => {
        return getScoreboard(input.sport, input.league, {
          dates: input.dates,
          week: input.week,
          limit: input.limit,
        });
      }),

    // Quick access to major leagues
    nfl: publicProcedure.query(() => getNflScoreboard()),
    nba: publicProcedure.query(() => getNbaScoreboard()),
    mlb: publicProcedure.query(() => getMlbScoreboard()),
    nhl: publicProcedure.query(() => getNhlScoreboard()),

    // Soccer with league selection
    soccer: publicProcedure
      .input(
        z.object({
          league: z.string().default("eng.1"), // Premier League by default
        })
      )
      .query(({ input }) => getSoccerScoreboard(input.league)),
  }),

  // ==================== TEAMS ====================
  teams: router({
    // Get all teams in a league
    list: publicProcedure
      .input(
        z.object({
          sport: z.string().default("football"),
          league: z.string().default("nfl"),
        })
      )
      .query(({ input }) => getTeams(input.sport, input.league)),

    // Get single team details
    detail: publicProcedure
      .input(
        z.object({
          sport: z.string(),
          league: z.string(),
          teamId: z.string(),
        })
      )
      .query(({ input }) => getTeamDetail(input.sport, input.league, input.teamId)),

    // Get team roster
    roster: publicProcedure
      .input(
        z.object({
          sport: z.string(),
          league: z.string(),
          teamId: z.string(),
        })
      )
      .query(({ input }) => getTeamRoster(input.sport, input.league, input.teamId)),

    // Get team schedule
    schedule: publicProcedure
      .input(
        z.object({
          sport: z.string(),
          league: z.string(),
          teamId: z.string(),
        })
      )
      .query(({ input }) => getTeamSchedule(input.sport, input.league, input.teamId)),

    // Get team injuries
    injuries: publicProcedure
      .input(
        z.object({
          sport: z.string(),
          league: z.string(),
          teamId: z.string(),
        })
      )
      .query(({ input }) => getTeamInjuries(input.sport, input.league, input.teamId)),

    // Get team logo URL
    logoUrl: publicProcedure
      .input(
        z.object({
          sport: z.string(),
          teamAbbr: z.string(),
          size: z.number().optional().default(500),
        })
      )
      .query(({ input }) => getTeamLogoUrl(input.sport, input.teamAbbr, input.size)),
  }),

  // ==================== STANDINGS ====================
  standings: router({
    get: publicProcedure
      .input(
        z.object({
          sport: z.string().default("football"),
          league: z.string().default("nfl"),
        })
      )
      .query(({ input }) => getStandings(input.sport, input.league)),
  }),

  // ==================== ATHLETES ====================
  athletes: router({
    // Get athlete profile
    profile: publicProcedure
      .input(
        z.object({
          sport: z.string(),
          league: z.string(),
          athleteId: z.string(),
        })
      )
      .query(({ input }) => getAthlete(input.sport, input.league, input.athleteId)),

    // Get athlete game log
    gameLog: publicProcedure
      .input(
        z.object({
          sport: z.string(),
          league: z.string(),
          athleteId: z.string(),
        })
      )
      .query(({ input }) => getAthleteGameLog(input.sport, input.league, input.athleteId)),

    // Get athlete statistics
    stats: publicProcedure
      .input(
        z.object({
          sport: z.string(),
          league: z.string(),
          athleteId: z.string(),
        })
      )
      .query(({ input }) => getAthleteStats(input.sport, input.league, input.athleteId)),

    // Get athlete news
    news: publicProcedure
      .input(
        z.object({
          sport: z.string(),
          league: z.string(),
          athleteId: z.string(),
        })
      )
      .query(({ input }) => getAthleteNews(input.sport, input.league, input.athleteId)),

    // Get athlete headshot URL
    headshotUrl: publicProcedure
      .input(
        z.object({
          sport: z.string(),
          playerId: z.string(),
        })
      )
      .query(({ input }) => getAthleteHeadshotUrl(input.sport, input.playerId)),
  }),

  // ==================== ODDS & BETTING ====================
  odds: router({
    // Get game odds from multiple providers
    gameOdds: publicProcedure
      .input(
        z.object({
          sport: z.string(),
          league: z.string(),
          eventId: z.string(),
          competitionId: z.string(),
        })
      )
      .query(({ input }) =>
        getGameOdds(input.sport, input.league, input.eventId, input.competitionId)
      ),

    // Get win probability / game predictor
    predictor: publicProcedure
      .input(
        z.object({
          sport: z.string(),
          league: z.string(),
          eventId: z.string(),
          competitionId: z.string(),
        })
      )
      .query(({ input }) =>
        getGamePredictor(input.sport, input.league, input.eventId, input.competitionId)
      ),
  }),

  // ==================== GAME DETAILS ====================
  games: router({
    // Full game summary (box score + plays + stats)
    summary: publicProcedure
      .input(
        z.object({
          sport: z.string(),
          league: z.string(),
          eventId: z.string(),
        })
      )
      .query(({ input }) => getGameSummary(input.sport, input.league, input.eventId)),

    // Play-by-play breakdown
    playByPlay: publicProcedure
      .input(
        z.object({
          sport: z.string(),
          league: z.string(),
          eventId: z.string(),
          competitionId: z.string(),
        })
      )
      .query(({ input }) =>
        getPlayByPlay(input.sport, input.league, input.eventId, input.competitionId)
      ),
  }),

  // ==================== NEWS ====================
  news: router({
    feed: publicProcedure
      .input(
        z.object({
          sport: z.string().optional(),
          limit: z.number().default(25),
        })
      )
      .query(({ input }) => getSportNews(input.sport, input.limit)),
  }),

  // ==================== SPECIALIZED ====================
  specialized: router({
    // NFL QB Rating
    qbr: publicProcedure
      .input(
        z.object({
          year: z.number(),
          type: z.number().default(2), // 1=preseason, 2=regular, 3=postseason
          group: z.number().default(1),
          split: z.number().default(0), // 0=total, 1=home, 2=away
        })
      )
      .query(({ input }) =>
        getQbr(input.year, input.type, input.group, input.split)
      ),

    // Power Index (BPI/SP+)
    powerIndex: publicProcedure
      .input(
        z.object({
          sport: z.string(),
          league: z.string(),
          year: z.number(),
        })
      )
      .query(({ input }) => getPowerIndex(input.sport, input.league, input.year)),

    // Statistical leaders
    leaders: publicProcedure
      .input(
        z.object({
          sport: z.string(),
          league: z.string(),
        })
      )
      .query(({ input }) => getLeaders(input.sport, input.league)),
  }),

  // ==================== SEARCH ====================
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        sport: z.string().optional(),
        limit: z.number().default(10),
      })
    )
    .query(({ input }) => searchEspn(input.query, input.sport, input.limit)),
});

export type ESPNRouter = typeof espnRouter;
