FROM eclipse-temurin:21-jre
WORKDIR /app
ENV APP_MODE=legacy
ENV DEBUG=true
COPY java-service/ /app/java-service/
COPY angular-portal/ /app/angular-portal/
COPY react-dashboard/ /app/react-dashboard/
COPY dotnet-api/ /app/dotnet-api/
COPY python-jobs/ /app/python-jobs/
CMD ["java", "-version"]
