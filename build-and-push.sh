#!/bin/bash

# Build and Push Docker Image Script
# Usage: ./build-and-push.sh [tag]

set -e

# Configuration
DOCKER_USERNAME="kennteohstorehub"
IMAGE_NAME="shiftadjuster"
TAG=${1:-latest}
FULL_IMAGE_NAME="$DOCKER_USERNAME/$IMAGE_NAME:$TAG"

echo "🐳 Building Docker image: $FULL_IMAGE_NAME"

# Build the Docker image
docker build -t $FULL_IMAGE_NAME .

echo "✅ Docker image built successfully"

# Login to Docker Hub (you'll be prompted for credentials)
echo "🔐 Logging in to Docker Hub..."
docker login

# Push the image
echo "📤 Pushing image to Docker Hub..."
docker push $FULL_IMAGE_NAME

# Also tag as latest if not already
if [ "$TAG" != "latest" ]; then
    echo "🏷️  Tagging as latest..."
    docker tag $FULL_IMAGE_NAME $DOCKER_USERNAME/$IMAGE_NAME:latest
    docker push $DOCKER_USERNAME/$IMAGE_NAME:latest
fi

echo "🎉 Successfully built and pushed: $FULL_IMAGE_NAME"
echo ""
echo "To use this image:"
echo "docker pull $FULL_IMAGE_NAME"
echo "docker run -p 3000:3000 $FULL_IMAGE_NAME"
echo ""
echo "Or use with docker-compose:"
echo "Update your docker-compose.yml to use: image: $FULL_IMAGE_NAME" 