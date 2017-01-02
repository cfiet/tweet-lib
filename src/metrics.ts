import * as os from "os";
import { format, parse, Url } from "url";
import { Counter, Gauge, Histogram, Pushgateway, Summary, defaultMetrics, register } from "prom-client";
export { Counter, Gauge, Histogram, Summary } from "prom-client";

import { Logger, createLogger } from "./logging";

export type Labels = { [ key: string ]: string };

const logger = createLogger("tweet-lib", "metrics");

export interface MetricsOptions {
  metricsPushgatewayUrl: string;
  metricsPushgatewayPushInterval: number;
  metricsDefaultBlacklist?: string[];
  metricsInterval?: number;
  metricsJobName: string;
}

export class MetricsClient {

  private static _default: MetricsClient;
  public static get default () {
    return MetricsClient._default;
  }

  private _interval: NodeJS.Timer;
  private _pushgateway: Pushgateway;
  private _params: Pushgateway.Parameters;
  private _logger: Logger;

  get running (): boolean {
    return !!this._interval;
  }

  private constructor(
    private _url: Url,
    private _pushInterval: number,
    jobName: string,
    groupings: Labels
  ) {
    this._params = { jobName, groupings };
    this._logger = createLogger('tweet-lib', 'metrics', 'client', `${_url.host}:${_url.port}`);
    this._pushgateway = new Pushgateway(_url.href);
    
    process.once("uncaughtException", () => {
      this.pause();
      this.dispose();
    });

    this._pushStats();
    this.resume();
  }

  public resume() {
    this._interval = setInterval(() => {
      this._pushStats()
    }, this._pushInterval);
  }

  public pause() {
    clearInterval(this._interval);
    this._interval = null;
  }

  private _pushStats() {
    this._logger.info(`Pushing stats to Pushgateway`, this._params);
    this._pushgateway.pushAdd(this._params, (error: Error) => {
      if (error) {
        this._logger.error(`An error occured while pushing stats to Pushgateway: ${error.message}`, { error, params: this._params })
        return;
      }
      this._logger.info(`Successfully pushed stats to Pushgateway`);
    });
  }

  public dispose(): Promise<void> {
    this.pause();
    this._logger.info(`Disposing Pushgateway stats`);
    return new Promise<void>((resolve, reject) => {
      this._pushgateway.delete(this._params, (error: Error) => {
        if (error) {
          this._logger.error(`An error occured while disposing Pushgateway stats: ${error.message}`, { error, params: this._params });
          return reject(error);
        }
        this._logger.info('Successfully disposed Pushgateway stats', this._params);
        return resolve();
      });
    });
  }

  public static create(
    options: MetricsOptions,
    labels: Labels,
  ): MetricsClient {
    defaultMetrics(options.metricsDefaultBlacklist, options.metricsInterval);
    logger.info("Registered default metrics", {
      blacklist: options.metricsDefaultBlacklist,
      interval: options.metricsInterval
    });

    const pushgatewayUrl = parse(options.metricsPushgatewayUrl);
    return new MetricsClient(
      pushgatewayUrl,
      options.metricsPushgatewayPushInterval,
      options.metricsJobName,
      labels
    );
  }

  public static start(options: MetricsOptions): void {
    function getDefaultLabels() {
      return {
        hostname: os.hostname(),
        username: os.userInfo().username
      };
    }

    if (MetricsClient._default) {
      MetricsClient._default.dispose();
    }

    MetricsClient._default = MetricsClient.create(options, {
      hostname: os.hostname(),
      username: os.userInfo().username.toString()
    });
  }
}

export default MetricsClient;