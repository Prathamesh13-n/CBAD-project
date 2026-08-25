# CDAD — College Digital Academic Dashboard
# Single-container static frontend served by Nginx.

FROM nginx:alpine

# Remove default Nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy the frontend into Nginx's web root
COPY index.html /usr/share/nginx/html/
COPY student.html /usr/share/nginx/html/
COPY faculty.html /usr/share/nginx/html/
COPY group-details.html /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/
COPY assets/ /usr/share/nginx/html/assets/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
