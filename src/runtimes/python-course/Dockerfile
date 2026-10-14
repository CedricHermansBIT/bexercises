# Immutable official Python base; the dependency lock targets Linux amd64/Python 3.11.
FROM docker.io/library/python@sha256:9a7765b36773a37061455b332f18e265e7f58f6fea9c419a550d2a8b0e9db834
COPY requirements.lock /opt/bitlab/requirements.lock
RUN python -m pip install --no-cache-dir --only-binary=:all: --require-hashes -r /opt/bitlab/requirements.lock \
    && python -m pip check \
    && groupadd --gid 1000 runner \
    && useradd --uid 1000 --gid 1000 --create-home runner
ENV OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 MPLBACKEND=Agg \
    MPLCONFIGDIR=/tmp/matplotlib XDG_CACHE_HOME=/tmp/cache PYTHONDONTWRITEBYTECODE=1
USER 1000:1000
WORKDIR /home/runner
CMD ["python3"]
