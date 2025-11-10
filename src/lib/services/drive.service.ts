// src/lib/services/drive.service.ts
// Drive management service
// Handles drive creation, updates, and play linkage for drive-level analytics

import { createClient } from '@/utils/supabase/client';
import type { Drive, PlayInstance } from '@/types/football';

export interface CreateDriveParams {
  gameId: string;
  teamId: string;
  driveNumber: number;
  quarter: number;
  startYardLine: number;
  possessionType: 'offense' | 'defense';
  startTime?: number;
}

export interface UpdateDriveParams {
  endYardLine?: number;
  endTime?: number;
  result?: 'touchdown' | 'field_goal' | 'punt' | 'turnover' | 'downs' | 'end_half' | 'end_game' | 'safety';
  notes?: string;
}

export interface DriveWithPlays extends Drive {
  plays: PlayInstance[];
}

export class DriveService {
  private supabase = createClient();

  /**
   * Create a new drive
   * Auto-populates initial values
   */
  async createDrive(params: CreateDriveParams): Promise<Drive> {
    const { data: { user } } = await this.supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await this.supabase
      .from('drives')
      .insert({
        game_id: params.gameId,
        team_id: params.teamId,
        drive_number: params.driveNumber,
        quarter: params.quarter,
        possession_type: params.possessionType,
        start_yard_line: params.startYardLine,
        start_time: params.startTime,
        end_yard_line: params.startYardLine, // Initial value
        plays_count: 0,
        yards_gained: 0,
        first_downs: 0,
        result: 'end_half', // Placeholder until drive completes
        points: 0,
        three_and_out: false,
        reached_red_zone: false,
        scoring_drive: false,
        created_by: user.id
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create drive: ${error.message}`);

    return data as Drive;
  }

  /**
   * Update drive details
   * Trigger automatically computes derived fields (three_and_out, scoring_drive)
   */
  async updateDrive(driveId: string, updates: UpdateDriveParams): Promise<Drive> {
    const { data, error } = await this.supabase
      .from('drives')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', driveId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update drive: ${error.message}`);

    return data as Drive;
  }

  /**
   * Complete a drive with final result
   * Auto-calculates points based on result
   */
  async completeDrive(
    driveId: string,
    result: 'touchdown' | 'field_goal' | 'punt' | 'turnover' | 'downs' | 'end_half' | 'end_game' | 'safety',
    endYardLine: number,
    endTime?: number
  ): Promise<Drive> {
    // Calculate points
    let points = 0;
    if (result === 'touchdown') points = 6; // Doesn't include PAT
    if (result === 'field_goal') points = 3;
    if (result === 'safety') points = 2;

    return this.updateDrive(driveId, {
      result,
      endYardLine,
      endTime
    });
  }

  /**
   * Delete a drive
   * Only owners and coaches can delete
   */
  async deleteDrive(driveId: string): Promise<void> {
    // Unlink all plays from this drive first
    const { error: unlinkError } = await this.supabase
      .from('play_instances')
      .update({ drive_id: null })
      .eq('drive_id', driveId);

    if (unlinkError) throw new Error(`Failed to unlink plays: ${unlinkError.message}`);

    // Delete drive
    const { error } = await this.supabase
      .from('drives')
      .delete()
      .eq('id', driveId);

    if (error) throw new Error(`Failed to delete drive: ${error.message}`);
  }

  /**
   * Link a play instance to a drive
   * Updates drive stats (plays_count, yards_gained, first_downs)
   */
  async addPlayToDrive(playInstanceId: string, driveId: string): Promise<void> {
    // Get play details
    const { data: play, error: playError } = await this.supabase
      .from('play_instances')
      .select('yards_gained, resulted_in_first_down')
      .eq('id', playInstanceId)
      .single();

    if (playError || !play) throw new Error('Play instance not found');

    // Link play to drive
    const { error: linkError } = await this.supabase
      .from('play_instances')
      .update({ drive_id: driveId })
      .eq('id', playInstanceId);

    if (linkError) throw new Error(`Failed to link play: ${linkError.message}`);

    // Update drive stats
    await this.recalculateDriveStats(driveId);
  }

  /**
   * Remove a play from a drive
   */
  async removePlayFromDrive(playInstanceId: string): Promise<void> {
    // Get current drive_id before unlinking
    const { data: play } = await this.supabase
      .from('play_instances')
      .select('drive_id')
      .eq('id', playInstanceId)
      .single();

    const driveId = play?.drive_id;

    // Unlink play
    const { error } = await this.supabase
      .from('play_instances')
      .update({ drive_id: null })
      .eq('id', playInstanceId);

    if (error) throw new Error(`Failed to remove play: ${error.message}`);

    // Recalculate drive stats if it was linked
    if (driveId) {
      await this.recalculateDriveStats(driveId);
    }
  }

  /**
   * Recalculate drive statistics based on linked plays
   * Called after adding/removing plays
   */
  async recalculateDriveStats(driveId: string): Promise<void> {
    // Get all plays for this drive
    const { data: plays, error: playsError } = await this.supabase
      .from('play_instances')
      .select('yards_gained, resulted_in_first_down, yard_line')
      .eq('drive_id', driveId);

    if (playsError) throw new Error(`Failed to fetch plays: ${playsError.message}`);

    const playsCount = plays?.length || 0;
    const yardsGained = plays?.reduce((sum, p) => sum + (p.yards_gained || 0), 0) || 0;
    const firstDowns = plays?.filter(p => p.resulted_in_first_down).length || 0;

    // Check if drive reached red zone (any play inside 20)
    const reachedRedZone = plays?.some(p => p.yard_line && p.yard_line >= 80) || false;

    // Update drive
    const { error: updateError } = await this.supabase
      .from('drives')
      .update({
        plays_count: playsCount,
        yards_gained: yardsGained,
        first_downs: firstDowns,
        reached_red_zone: reachedRedZone,
        updated_at: new Date().toISOString()
      })
      .eq('id', driveId);

    if (updateError) throw new Error(`Failed to update drive stats: ${updateError.message}`);
  }

  /**
   * Get all drives for a game
   * Optionally filter by possession type (offense/defense)
   */
  async getDrivesForGame(gameId: string, possessionType?: 'offense' | 'defense'): Promise<Drive[]> {
    let query = this.supabase
      .from('drives')
      .select('*')
      .eq('game_id', gameId);

    if (possessionType) {
      query = query.eq('possession_type', possessionType);
    }

    const { data, error } = await query.order('drive_number', { ascending: true });

    if (error) throw new Error(`Failed to fetch drives: ${error.message}`);

    return (data as Drive[]) || [];
  }

  /**
   * Get all drives for a team (across all games)
   */
  async getDrivesForTeam(teamId: string): Promise<Drive[]> {
    const { data, error } = await this.supabase
      .from('drives')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch drives: ${error.message}`);

    return (data as Drive[]) || [];
  }

  /**
   * Get a single drive with all its plays
   */
  async getDriveWithPlays(driveId: string): Promise<DriveWithPlays> {
    // Get drive
    const { data: drive, error: driveError } = await this.supabase
      .from('drives')
      .select('*')
      .eq('id', driveId)
      .single();

    if (driveError || !drive) throw new Error('Drive not found');

    // Get plays
    const { data: plays, error: playsError } = await this.supabase
      .from('play_instances')
      .select('*')
      .eq('drive_id', driveId)
      .order('timestamp_start', { ascending: true });

    if (playsError) throw new Error(`Failed to fetch plays: ${playsError.message}`);

    return {
      ...drive,
      plays: (plays as PlayInstance[]) || []
    } as DriveWithPlays;
  }

  /**
   * Auto-create drives from play instances
   * Groups consecutive plays into drives based on possession changes
   * Useful for importing legacy data
   */
  async autoCreateDrives(gameId: string, teamId: string, possessionType: 'offense' | 'defense' = 'offense'): Promise<Drive[]> {
    // Get all play instances for this game/team, ordered by timestamp
    const { data: videos } = await this.supabase
      .from('videos')
      .select('id')
      .eq('game_id', gameId);

    if (!videos || videos.length === 0) return [];

    const videoIds = videos.map(v => v.id);

    // Filter plays based on possession type
    // offense = your team's plays (is_opponent_play = false)
    // defense = opponent's plays (is_opponent_play = true)
    const { data: plays, error } = await this.supabase
      .from('play_instances')
      .select('*')
      .in('video_id', videoIds)
      .eq('team_id', teamId)
      .eq('is_opponent_play', possessionType === 'defense')
      .order('timestamp_start', { ascending: true });

    if (error || !plays || plays.length === 0) return [];

    // Group plays into drives
    // A new drive starts when:
    // - Quarter changes
    // - Turnover occurs
    // - Score changes
    // - Drive result detected (punt, touchdown, etc.)

    const drives: Drive[] = [];
    let currentDrive: CreateDriveParams | null = null;
    let currentDrivePlays: string[] = [];
    let driveNumber = 1;

    for (let i = 0; i < plays.length; i++) {
      const play = plays[i];

      // Start first drive
      if (!currentDrive) {
        currentDrive = {
          gameId,
          teamId,
          driveNumber,
          quarter: play.quarter || 1,
          startYardLine: play.yard_line || 75, // Default to own 25
          possessionType,
          startTime: play.timestamp_start
        };
        currentDrivePlays = [play.id];
        continue;
      }

      // Check if new drive should start
      const shouldStartNewDrive =
        play.quarter !== currentDrive.quarter ||
        play.is_turnover ||
        (play.result && ['touchdown', 'field_goal', 'punt'].some(r => play.result?.includes(r)));

      if (shouldStartNewDrive) {
        // Complete current drive
        const createdDrive = await this.createDrive(currentDrive);
        drives.push(createdDrive);

        // Link plays to drive
        for (const playId of currentDrivePlays) {
          await this.addPlayToDrive(playId, createdDrive.id);
        }

        // Determine drive result from last play
        let result: Drive['result'] = 'end_half';
        if (play.is_turnover) result = 'turnover';
        else if (play.result?.includes('touchdown')) result = 'touchdown';
        else if (play.result?.includes('field_goal')) result = 'field_goal';
        else if (play.result?.includes('punt')) result = 'punt';

        // Complete the drive
        await this.completeDrive(
          createdDrive.id,
          result,
          play.yard_line || currentDrive.startYardLine,
          play.timestamp_end || play.timestamp_start
        );

        // Start new drive
        driveNumber++;
        currentDrive = {
          gameId,
          teamId,
          driveNumber,
          quarter: play.quarter || currentDrive.quarter,
          startYardLine: play.yard_line || 75,
          possessionType,
          startTime: play.timestamp_start
        };
        currentDrivePlays = [play.id];
      } else {
        // Continue current drive
        currentDrivePlays.push(play.id);
      }
    }

    // Complete final drive if exists
    if (currentDrive && currentDrivePlays.length > 0) {
      const createdDrive = await this.createDrive(currentDrive);
      drives.push(createdDrive);

      for (const playId of currentDrivePlays) {
        await this.addPlayToDrive(playId, createdDrive.id);
      }

      // Mark as end of game
      const lastPlay = plays[plays.length - 1];
      await this.completeDrive(
        createdDrive.id,
        'end_game',
        lastPlay.yard_line || currentDrive.startYardLine,
        lastPlay.timestamp_end || lastPlay.timestamp_start
      );
    }

    return drives;
  }

  /**
   * Calculate Points Per Drive using database function
   */
  async calculatePPD(teamId: string): Promise<number> {
    const { data, error } = await this.supabase
      .rpc('calculate_ppd', { p_team_id: teamId });

    if (error) throw new Error(`Failed to calculate PPD: ${error.message}`);

    return data || 0;
  }

  /**
   * Calculate 3-and-out rate
   */
  async calculate3AndOutRate(teamId: string): Promise<number> {
    const { data: drives, error } = await this.supabase
      .from('drives')
      .select('three_and_out')
      .eq('team_id', teamId);

    if (error || !drives || drives.length === 0) return 0;

    const threeAndOuts = drives.filter(d => d.three_and_out).length;
    return (threeAndOuts / drives.length) * 100;
  }

  /**
   * Calculate red zone touchdown rate
   */
  async calculateRedZoneTDRate(teamId: string): Promise<number> {
    const { data: drives, error } = await this.supabase
      .from('drives')
      .select('reached_red_zone, result')
      .eq('team_id', teamId);

    if (error || !drives || drives.length === 0) return 0;

    const redZoneDrives = drives.filter(d => d.reached_red_zone);
    if (redZoneDrives.length === 0) return 0;

    const redZoneTDs = redZoneDrives.filter(d => d.result === 'touchdown').length;
    return (redZoneTDs / redZoneDrives.length) * 100;
  }
}
