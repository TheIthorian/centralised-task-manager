import { HttpClient } from "@ctm/http-client";
import type {
  CreateTaskDto,
  OAuthTokens,
  RemoteTask,
  TaskConnector,
  UpdateTaskDto,
} from "../types.js";

export interface TodoistConnectorConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface TodoistTask {
  id: string;
  content: string;
  description: string;
  is_completed: boolean;
  priority: number;
  due: { date: string } | null;
  labels: string[];
}

interface TodoistTokenResponse {
  access_token: string;
  token_type: string;
}

export class TodoistConnector implements TaskConnector {
  readonly source = "todoist";

  private readonly http = new HttpClient({ baseUrl: "https://api.todoist.com/rest/v2" });

  private readonly authHttp = new HttpClient({ baseUrl: "https://todoist.com" });

  constructor(private readonly config: TodoistConnectorConfig) {}

  /** Build the OAuth authorization URL for the given user state. */
  getAuthUrl(userId: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      scope: "task:add,data:read,data:delete",
      state: userId,
      redirect_uri: this.config.redirectUri,
    });

    return `https://todoist.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * Todoist access tokens are long-lived (no expiry) and do not support refresh.
   * refreshToken is stored as '' and refreshToken() is intentionally a no-op.
   */
  async exchangeCode(code: string): Promise<OAuthTokens> {
    const response = await this.authHttp.post<TodoistTokenResponse>("/oauth/access_token", {
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
      redirect_uri: this.config.redirectUri,
    });

    return {
      accessToken: response.access_token,
      refreshToken: "",
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    };
  }

  /** Todoist tokens do not expire; return tokens unchanged. */
  async refreshToken(tokens: OAuthTokens): Promise<OAuthTokens> {
    return tokens;
  }

  /** Fetch all open tasks from the authenticated user's Todoist account. */
  async fetchTasks(tokens: OAuthTokens): Promise<RemoteTask[]> {
    const tasks = await this.http.get<TodoistTask[]>("/tasks", {
      Authorization: `Bearer ${tokens.accessToken}`,
    });

    return tasks.map((t) => this.toRemoteTask(t));
  }

  /** Create a new task in Todoist. */
  async createTask(tokens: OAuthTokens, task: CreateTaskDto): Promise<RemoteTask> {
    const created = await this.http.post<TodoistTask>(
      "/tasks",
      {
        content: task.title,
        description: task.description ?? "",
        due_date: task.dueDate?.toISOString().split("T")[0],
        priority: task.priority ?? 1,
      },
      { Authorization: `Bearer ${tokens.accessToken}` },
    );

    return this.toRemoteTask(created);
  }

  /** Update an existing task in Todoist. */
  async updateTask(
    tokens: OAuthTokens,
    sourceId: string,
    patch: UpdateTaskDto,
  ): Promise<RemoteTask> {
    const updated = await this.http.post<TodoistTask>(
      `/tasks/${sourceId}`,
      {
        content: patch.title,
        description: patch.description,
        due_date: patch.dueDate?.toISOString().split("T")[0],
        priority: patch.priority,
      },
      { Authorization: `Bearer ${tokens.accessToken}` },
    );

    return this.toRemoteTask(updated);
  }

  /** Mark a task as complete by posting to the close endpoint. */
  async completeTask(tokens: OAuthTokens, sourceId: string): Promise<void> {
    await this.http.post<void>(
      `/tasks/${sourceId}/close`,
      {},
      {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    );
  }

  /** Permanently delete a task from Todoist. */
  async deleteTask(tokens: OAuthTokens, sourceId: string): Promise<void> {
    await this.http.delete(`/tasks/${sourceId}`, {
      Authorization: `Bearer ${tokens.accessToken}`,
    });
  }

  private toRemoteTask(task: TodoistTask): RemoteTask {
    return {
      sourceId: task.id,
      title: task.content,
      description: task.description || null,
      status: task.is_completed ? "done" : "open",
      priority: task.priority,
      dueDate: task.due ? new Date(task.due.date) : null,
      tags: task.labels,
    };
  }
}
