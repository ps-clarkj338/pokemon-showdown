/**
 * Server Files Management Commands
 * 
 * Instructions:
 * - Obtain a GitHub "personal access token" with the "gist" permission.
 * - Set this token as Config.githubToken in your configuration.
 * - These commands are restricted to console/owner accounts for security.
 * 
 * Credits: HoeenHero (Original HasteBin Code)
 * Updates & Typescript Conversion: Prince Sky
 * Refactored: Modern TypeScript patterns and improved error handling
 */

import { request as httpsRequest, RequestOptions } from 'https';
import { FS } from '../lib/fs';

// Configuration and constants
const GITHUB_API_URL = 'https://api.github.com/gists';
const GITHUB_TOKEN: string | undefined = Config.githubToken;

// Type definitions
interface GistFile {
    filename?: string;
    content: string;
    type?: string;
}

interface GistData {
    description: string;
    public: boolean;
    files: { [filename: string]: GistFile };
}

interface GistResponse {
    id: string;
    html_url: string;
    files: { [filename: string]: { raw_url: string } };
}

interface GitHubAPIError {
    message: string;
    errors?: Array<{ message: string }>;
}

// Error classes
class FileManagementError extends Error {
    constructor(message: string, public readonly code?: string) {
        super(message);
        this.name = 'FileManagementError';
    }
}

class GitHubAPIError extends FileManagementError {
    constructor(message: string, public readonly statusCode?: number) {
        super(message, 'GITHUB_API_ERROR');
        this.name = 'GitHubAPIError';
    }
}

/**
 * Utility class for server file management operations
 */
class FileManager {
    private static instance: FileManager;

    private constructor() {}

    static getInstance(): FileManager {
        if (!FileManager.instance) {
            FileManager.instance = new FileManager();
        }
        return FileManager.instance;
    }

    /**
     * Validates if GitHub token is configured
     */
    private validateGitHubToken(): void {
        if (!GITHUB_TOKEN) {
            throw new FileManagementError(
                'GitHub token not configured. Please set Config.githubToken.',
                'NO_GITHUB_TOKEN'
            );
        }
    }

    /**
     * Validates file path security
     */
    private validateFilePath(filePath: string): void {
        // Prevent directory traversal attacks
        if (filePath.includes('..') || filePath.includes('~')) {
            throw new FileManagementError(
                'Invalid file path: Directory traversal not allowed',
                'INVALID_PATH'
            );
        }

        // Prevent access to sensitive files
        const sensitivePatterns = [
            /^\/etc\//,
            /^\/root\//,
            /^\/home\/[^\/]+\/\.[^\/]/,
            /\.env$/,
            /\.key$/,
            /\.pem$/,
        ];

        if (sensitivePatterns.some(pattern => pattern.test(filePath))) {
            throw new FileManagementError(
                'Access to sensitive files is not allowed',
                'SENSITIVE_FILE'
            );
        }
    }

    /**
     * Makes HTTPS request to GitHub API
     */
    private makeGitHubRequest(
        method: string,
        data?: string
    ): Promise<{ statusCode: number; body: string }> {
        return new Promise((resolve, reject) => {
            const options: RequestOptions = {
                hostname: 'api.github.com',
                path: '/gists',
                method,
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'User-Agent': 'Pokemon-Showdown-Server',
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json',
                },
            };

            if (data) {
                options.headers!['Content-Length'] = Buffer.byteLength(data);
            }

            const req = httpsRequest(options, (res) => {
                let body = '';

                res.on('data', (chunk) => {
                    body += chunk;
                });

                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode || 0,
                        body
                    });
                });
            });

            req.on('error', (error) => {
                reject(new FileManagementError(
                    `Request failed: ${error.message}`,
                    'REQUEST_FAILED'
                ));
            });

            req.setTimeout(30000, () => {
                req.destroy();
                reject(new FileManagementError(
                    'Request timeout (30s)',
                    'REQUEST_TIMEOUT'
                ));
            });

            if (data) {
                req.write(data);
            }

            req.end();
        });
    }

    /**
     * Uploads file content to GitHub Gist
     */
    async uploadToGist(filePath: string, content: string): Promise<GistResponse> {
        this.validateGitHubToken();
        this.validateFilePath(filePath);

        const fileName = filePath.split('/').pop() || 'file.txt';
        const gistData: GistData = {
            description: `Pokemon Showdown Server File: ${fileName}`,
            public: false,
            files: {
                [fileName]: {
                    content: content
                }
            }
        };

        try {
            const response = await this.makeGitHubRequest('POST', JSON.stringify(gistData));

            if (response.statusCode === 201) {
                return JSON.parse(response.body) as GistResponse;
            } else {
                const errorData = JSON.parse(response.body) as GitHubAPIError;
                throw new GitHubAPIError(
                    errorData.message || 'GitHub API request failed',
                    response.statusCode
                );
            }
        } catch (error) {
            if (error instanceof FileManagementError) {
                throw error;
            }
            throw new FileManagementError(
                `Failed to upload to GitHub Gist: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'GIST_UPLOAD_FAILED'
            );
        }
    }

    /**
     * Reads file content safely
     */
    async readFileContent(filePath: string): Promise<string> {
        this.validateFilePath(filePath);

        try {
            const fsPath = FS(filePath);

            if (!(await fsPath.exists())) {
                throw new FileManagementError(
                    `File not found: ${filePath}`,
                    'FILE_NOT_FOUND'
                );
            }

            if (!(await fsPath.isFile())) {
                throw new FileManagementError(
                    `Path is not a file: ${filePath}`,
                    'NOT_A_FILE'
                );
            }

            return await fsPath.read();
        } catch (error) {
            if (error instanceof FileManagementError) {
                throw error;
            }
            throw new FileManagementError(
                `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'FILE_READ_FAILED'
            );
        }
    }

    /**
     * Gets file information
     */
    async getFileInfo(filePath: string): Promise<{
        exists: boolean;
        isFile: boolean;
        isDirectory: boolean;
    }> {
        this.validateFilePath(filePath);

        try {
            const fsPath = FS(filePath);
            const exists = await fsPath.exists();

            if (!exists) {
                return { exists: false, isFile: false, isDirectory: false };
            }

            const [isFile, isDirectory] = await Promise.all([
                fsPath.isFile(),
                fsPath.isDirectory()
            ]);

            return { exists, isFile, isDirectory };
        } catch (error) {
            throw new FileManagementError(
                `Failed to get file info: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'FILE_INFO_FAILED'
            );
        }
    }
}

/**
 * Notification utility for staff
 */
class StaffNotifier {
    private static getStaffRoom(): Room | null {
        return Rooms.get('staff') || null;
    }

    static notifyFileAction(
        action: string,
        file: string,
        user: User,
        info: string = ''
    ): void {
        const staffRoom = this.getStaffRoom();
        if (!staffRoom) return;

        const safeFile = Chat.escapeHTML(file);
        const safeUser = Chat.escapeHTML(user.id);
        const safeInfo = info ? Chat.escapeHTML(info) : '';

        const message = `<div class="broadcast-red">
            <strong>File Management Action:</strong><br />
            <strong>Action:</strong> ${Chat.escapeHTML(action)}<br />
            <strong>File:</strong> ${safeFile}<br />
            <strong>User:</strong> ${safeUser}${safeInfo ? `<br /><strong>Info:</strong> ${safeInfo}` : ''}
        </div>`;

        staffRoom.add(message).update();
    }

    static notifyError(
        action: string,
        file: string,
        user: User,
        error: Error
    ): void {
        this.notifyFileAction(
            `${action} (ERROR)`,
            file,
            user,
            `Error: ${error.message}`
        );
    }
}

// Command implementations
const fileManager = FileManager.getInstance();

export const commands: ChatCommands = {
    fileupload: 'fu',
    fu(target, room, user) {
        if (!this.can('console')) return;
        if (!target) return this.parse('/help fu');

        const filePath = target.trim();

        // Run async operation
        void (async () => {
            try {
                StaffNotifier.notifyFileAction('File Upload Started', filePath, user);

                const content = await fileManager.readFileContent(filePath);
                const gistResponse = await fileManager.uploadToGist(filePath, content);

                StaffNotifier.notifyFileAction(
                    'File Upload Completed',
                    filePath,
                    user,
                    `URL: ${gistResponse.html_url}`
                );

                return this.sendReply(
                    `File uploaded successfully! View at: ${gistResponse.html_url}`
                );
            } catch (error) {
                const err = error as FileManagementError;
                StaffNotifier.notifyError('File Upload', filePath, user, err);

                return this.errorReply(
                    `Upload failed: ${err.message}`
                );
            }
        })();
    },
    fuhelp: [
        `/fileupload [path] OR /fu [path] - Upload file to GitHub Gist (Requires: Console/Owner)`
    ],

    fileread: 'fr',
    fr(target, room, user) {
        if (!this.can('console')) return;
        if (!target) return this.parse('/help fr');

        const filePath = target.trim();

        // Run async operation
        void (async () => {
            try {
                StaffNotifier.notifyFileAction('File Read', filePath, user);

                const info = await fileManager.getFileInfo(filePath);

                if (!info.exists) {
                    return this.errorReply(`File not found: ${filePath}`);
                }

                if (!info.isFile) {
                    return this.errorReply(`Path is not a file: ${filePath}`);
                }

                const content = await fileManager.readFileContent(filePath);
                const truncatedContent = content.length > 1000 
                    ? content.substring(0, 1000) + '\n... (truncated)'
                    : content;

                return this.sendReply(
                    `File content (${filePath}):\n\`\`\`\n${truncatedContent}\n\`\`\``
                );
            } catch (error) {
                const err = error as FileManagementError;
                StaffNotifier.notifyError('File Read', filePath, user, err);

                return this.errorReply(
                    `Read failed: ${err.message}`
                );
            }
        })();
    },
    frhelp: [
        `/fileread [path] OR /fr [path] - Read file content (Requires: Console/Owner)`
    ],

    fileinfo: 'fi',
    fi(target, room, user) {
        if (!this.can('console')) return;
        if (!target) return this.parse('/help fi');

        const filePath = target.trim();

        // Run async operation
        void (async () => {
            try {
                StaffNotifier.notifyFileAction('File Info', filePath, user);

                const info = await fileManager.getFileInfo(filePath);

                if (!info.exists) {
                    return this.errorReply(`File not found: ${filePath}`);
                }

                const type = info.isFile ? 'File' : info.isDirectory ? 'Directory' : 'Unknown';

                return this.sendReply(
                    `File info for ${filePath}:\nType: ${type}\nExists: ${info.exists}`
                );
            } catch (error) {
                const err = error as FileManagementError;
                StaffNotifier.notifyError('File Info', filePath, user, err);

                return this.errorReply(
                    `Info failed: ${err.message}`
                );
            }
        })();
    },
    fihelp: [
        `/fileinfo [path] OR /fi [path] - Get file information (Requires: Console/Owner)`
    ],
};
