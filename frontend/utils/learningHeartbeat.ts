/**
 * Learning Heartbeat Manager
 *
 * 管理学习心跳包，每 30 秒向后端发送一次心跳以记录学习时长。
 * 支持离线队列和失败重试机制。
 */

interface HeartbeatSession {
  courseMapId: string;
  nodeId: number;
}

interface QueuedHeartbeat extends HeartbeatSession {
  timestamp: number;
}

interface HeartbeatResponse {
  acknowledged: boolean;
  total_study_seconds: number;
  reason?: string;
}

class LearningHeartbeatManager {
  private intervalId: number | null = null;
  private currentSession: HeartbeatSession | null = null;
  private readonly HEARTBEAT_INTERVAL_MS = 30000; // 30 秒
  private readonly QUEUE_KEY = 'evobook_heartbeat_queue';
  private readonly MAX_QUEUE_SIZE = 10;

  /**
   * 启动心跳（用户进入 node 学习页面时调用）
   */
  start(courseMapId: string, nodeId: number): void {
    // 如果已有会话在运行，先停止
    if (this.intervalId !== null) {
      this.stop();
    }

    console.log('[Heartbeat] Started', { courseMapId, nodeId });

    this.currentSession = { courseMapId, nodeId };

    // 立即发送一次心跳
    this.sendHeartbeat();

    // 启动定时器（每 30s 发送）
    this.intervalId = window.setInterval(() => {
      this.sendHeartbeat();
    }, this.HEARTBEAT_INTERVAL_MS);
  }

  /**
   * 停止心跳（离开页面时调用）
   */
  stop(): void {
    if (this.intervalId !== null) {
      window.clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[Heartbeat] Stopped');
    }
    this.currentSession = null;
  }

  /**
   * 发送心跳到后端
   */
  private async sendHeartbeat(): Promise<void> {
    if (!this.currentSession) {
      console.warn('[Heartbeat] No active session');
      return;
    }

    const { courseMapId, nodeId } = this.currentSession;

    try {
      // 动态导入 api.ts 以避免循环依赖
      const { sendLearningHeartbeat } = await import('./api');

      const response: HeartbeatResponse = await sendLearningHeartbeat({
        course_map_id: courseMapId,
        node_id: nodeId,
        client_timestamp: new Date().toISOString(),
      });

      if (response.acknowledged) {
        console.log('[Heartbeat] Acknowledged', {
          total_study_seconds: response.total_study_seconds,
        });

        // 触发自定义事件，通知其他组件学习时长已更新
        window.dispatchEvent(
          new CustomEvent('study-time-updated', {
            detail: { total_study_seconds: response.total_study_seconds },
          })
        );
      } else {
        console.warn('[Heartbeat] Not acknowledged', {
          reason: response.reason,
        });
      }
    } catch (error) {
      console.error('[Heartbeat] Failed to send', error);

      // 失败时存到队列
      this.queueFailedHeartbeat();
    }
  }

  /**
   * 存储失败的心跳到 localStorage 队列
   */
  private queueFailedHeartbeat(): void {
    if (!this.currentSession) {
      return;
    }

    try {
      const queue = this.getQueue();

      // 限制队列大小（最多 10 个）
      if (queue.length >= this.MAX_QUEUE_SIZE) {
        console.warn('[Heartbeat] Queue is full, dropping oldest entry');
        queue.shift();
      }

      queue.push({
        ...this.currentSession,
        timestamp: Date.now(),
      });

      localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
      console.log('[Heartbeat] Queued failed heartbeat', { queueLength: queue.length });
    } catch (error) {
      console.error('[Heartbeat] Failed to queue heartbeat', error);
    }
  }

  /**
   * 获取队列中的心跳
   */
  private getQueue(): QueuedHeartbeat[] {
    try {
      const queueData = localStorage.getItem(this.QUEUE_KEY);
      if (!queueData) {
        return [];
      }
      return JSON.parse(queueData);
    } catch (error) {
      console.error('[Heartbeat] Failed to read queue', error);
      return [];
    }
  }

  /**
   * 重试队列中的心跳
   */
  async retryQueuedHeartbeats(): Promise<void> {
    const queue = this.getQueue();

    if (queue.length === 0) {
      return;
    }

    console.log('[Heartbeat] Retrying queued heartbeats', { count: queue.length });

    const { sendLearningHeartbeat } = await import('./api');
    const successfulIndices: number[] = [];

    for (let i = 0; i < queue.length; i++) {
      const heartbeat = queue[i];

      try {
        const response: HeartbeatResponse = await sendLearningHeartbeat({
          course_map_id: heartbeat.courseMapId,
          node_id: heartbeat.nodeId,
          client_timestamp: new Date(heartbeat.timestamp).toISOString(),
        });

        if (response.acknowledged) {
          console.log('[Heartbeat] Retry successful', { index: i });
          successfulIndices.push(i);
        }
      } catch (error) {
        console.error('[Heartbeat] Retry failed', { index: i, error });
      }
    }

    // 移除成功的心跳
    if (successfulIndices.length > 0) {
      const newQueue = queue.filter((_, index) => !successfulIndices.includes(index));
      localStorage.setItem(this.QUEUE_KEY, JSON.stringify(newQueue));
      console.log('[Heartbeat] Removed successful retries', {
        removed: successfulIndices.length,
        remaining: newQueue.length,
      });
    }
  }
}

export const heartbeatManager = new LearningHeartbeatManager();
