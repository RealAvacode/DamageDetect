import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

export interface VideoFrameExtractionResult {
  success: boolean;
  frames: Buffer[];
  error?: string;
  metadata?: {
    duration: number;
    width: number;
    height: number;
    fps: number;
  };
}

/**
 * Extract frames from video file for AI analysis
 * @param videoBuffer - The video file buffer
 * @param numFrames - Number of frames to extract (default: 3)
 * @returns Promise with extracted frames and metadata
 */
export async function extractVideoFrames(
  videoBuffer: Buffer, 
  numFrames: number = 3
): Promise<VideoFrameExtractionResult> {
  const tempDir = tmpdir();
  const videoPath = path.join(tempDir, `video_${Date.now()}.mp4`);
  const framePattern = path.join(tempDir, `frame_${Date.now()}_%d.jpg`);
  
  try {
    // Write video buffer to temporary file
    await fs.writeFile(videoPath, videoBuffer);
    
    // Get video metadata first
    const metadata = await getVideoMetadata(videoPath);
    
    // Calculate frame extraction interval
    const interval = Math.max(1, Math.floor(metadata.duration / numFrames));
    
    // Extract frames using ffmpeg
    const ffmpegCommand = [
      'ffmpeg',
      '-i', `"${videoPath}"`,
      '-vf', `fps=1/${interval}`,
      '-vframes', numFrames.toString(),
      '-q:v', '2', // High quality
      '-f', 'image2',
      `"${framePattern}"`
    ].join(' ');
    
    await execAsync(ffmpegCommand);
    
    // Read extracted frame files
    const frames: Buffer[] = [];
    for (let i = 1; i <= numFrames; i++) {
      const framePath = framePattern.replace('%d', i.toString());
      try {
        const frameBuffer = await fs.readFile(framePath);
        frames.push(frameBuffer);
        // Clean up frame file
        await fs.unlink(framePath).catch(() => {});
      } catch (error) {
        console.warn(`Could not read frame ${i}:`, error);
      }
    }
    
    // Clean up video file
    await fs.unlink(videoPath).catch(() => {});
    
    if (frames.length === 0) {
      return {
        success: false,
        frames: [],
        error: 'No frames could be extracted from video'
      };
    }
    
    return {
      success: true,
      frames,
      metadata
    };
    
  } catch (error) {
    // Clean up any remaining files
    await fs.unlink(videoPath).catch(() => {});
    
    return {
      success: false,
      frames: [],
      error: `Video processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Get video metadata using ffprobe
 */
async function getVideoMetadata(videoPath: string): Promise<{
  duration: number;
  width: number;
  height: number;
  fps: number;
}> {
  try {
    const ffprobeCommand = [
      'ffprobe',
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      `"${videoPath}"`
    ].join(' ');
    
    const { stdout } = await execAsync(ffprobeCommand);
    const metadata = JSON.parse(stdout);
    
    const videoStream = metadata.streams.find((stream: any) => stream.codec_type === 'video');
    
    if (!videoStream) {
      throw new Error('No video stream found');
    }
    
    return {
      duration: parseFloat(metadata.format.duration) || 0,
      width: videoStream.width || 0,
      height: videoStream.height || 0,
      fps: eval(videoStream.r_frame_rate) || 0 // Parse fraction like "30/1"
    };
    
  } catch (error) {
    console.warn('Could not extract video metadata:', error);
    return {
      duration: 0,
      width: 0,
      height: 0,
      fps: 0
    };
  }
}

/**
 * Check if ffmpeg is available
 */
export async function checkFFmpegAvailability(): Promise<boolean> {
  try {
    await execAsync('ffmpeg -version');
    return true;
  } catch (error) {
    return false;
  }
}