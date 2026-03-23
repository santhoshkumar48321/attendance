# Use the official Playwright image which bundles all browser dependencies
FROM mcr.microsoft.com/playwright:v1.58.2-noble

# Set working directory
WORKDIR /app

# Copy dependency manifests first for better layer caching
COPY package.json ./

# Install Node.js dependencies (Playwright browsers are pre-installed in the base image)
RUN npm install --omit=dev

# Copy application source
COPY tracker.js ./

# Directory for the attendance log (can be mounted as a volume)
RUN mkdir -p /app/logs
ENV LOG_FILE=/app/logs/attendance_log.csv

# Run as non-root user provided by the Playwright base image
USER pwuser

# Pass the meeting URL at runtime:
#   docker run -e MEETING_URL="<teams-link>" -v $(pwd)/logs:/app/logs teams-tracker
CMD ["node", "tracker.js"]
