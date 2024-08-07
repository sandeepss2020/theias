# Use an Alpine base image with Node.js
FROM node:18.20.4-alpine

# Set the working directory
WORKDIR /workspace


# Install necessary build tools and dependencies
RUN apk add --no-cache \
    git \
    python3 \
    make \
    gcc \
    g++ \
    pkgconfig \
    libx11-dev \
    libxkbfile-dev \
    libsecret-dev


# Install distutils
RUN apk add --no-cache py3-setuptools

# Clone the Theia repository
RUN git clone https://github.com/eclipse-theia/theia

# Change directory to theia
WORKDIR /workspace/theia

# Install project dependencies
RUN yarn

# Download plugins
RUN yarn download:plugins

# Build the browser application
RUN yarn browser build

# Expose port 3000 for the Theia application
EXPOSE 3000

# Start the Theia browser application
CMD ["yarn", "browser", "start", "--hostname", "0.0.0.0"]
