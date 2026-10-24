FROM postgres:16-alpine

RUN apk add --no-cache aws-cli tzdata

COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh \
  && echo '0 0 * * * /usr/local/bin/backup.sh > /proc/1/fd/1 2>&1' > /etc/crontabs/root

CMD ["crond", "-f", "-l", "8"]
