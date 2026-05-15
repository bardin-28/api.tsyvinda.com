FROM nginxproxy/nginx-proxy

ARG BASIC_AUTH=false
ARG BASIC_AUTH_USERNAME
ARG BASIC_AUTH_PASSWORD
ARG BASIC_AUTH_HOST

RUN if [ "$BASIC_AUTH" = "true" ] && [ -n "$BASIC_AUTH_USERNAME" ]; then \
    apt-get update -qq && apt-get install -y -qq apache2-utils && \
    rm -rf /var/lib/apt/lists/* && \
    mkdir -p /etc/nginx/htpasswd && \
    htpasswd -bc "/etc/nginx/htpasswd/${BASIC_AUTH_HOST}" "${BASIC_AUTH_USERNAME}" "${BASIC_AUTH_PASSWORD}" && \
    mkdir -p /etc/nginx/vhost.d && \
    printf 'auth_basic "Restricted";\nauth_basic_user_file /etc/nginx/htpasswd/%s;\n' \
        "${BASIC_AUTH_HOST}" > "/etc/nginx/vhost.d/${BASIC_AUTH_HOST}"; \
    fi
