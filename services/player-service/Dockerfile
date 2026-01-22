FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma

# Install deps
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Copy source
COPY . .

# Build TS
RUN npm run build

# 🔥 RUN MIGRATIONS AT CONTAINER START
CMD sh -c "npx prisma db push && npm start"
