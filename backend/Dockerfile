FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml ./
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 mvn -B package -DskipTests

FROM eclipse-temurin:21-jre-jammy
RUN groupadd --system dvizh && useradd --system --gid dvizh dvizh
WORKDIR /app
COPY --from=build --chown=dvizh:dvizh /workspace/target/sport-hub-backend-1.0.0.jar app.jar
USER dvizh
EXPOSE 8080
ENTRYPOINT ["java","-XX:MaxRAMPercentage=75.0","-jar","app.jar"]
