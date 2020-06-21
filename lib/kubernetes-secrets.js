'use strict'

/**
 * Kubernetes secret observer.
 * @param {string} timeoutId - An ID of setTimeout which schedules next poll of internal secrets.
 * @param {Object} secrets - Object of secret names present in given namespace.

 * Watch for Kubernetes secrets, and provide status promises.
 */

/** Kubernetes secret observer class. */
class KubernetesSecrets {

    /**
     * A set of secret observer instances for namespaces.
     */
    static secretObservers = {}

    /**
     * Create secrets observer.
     * @param {Object} namespace - A namespace to poll for internal secrets.
     * @param {number} intervalMilliseconds - Interval time in milliseconds for polling secret properties.
     * @param {Object} logger - Logger for logging stuff.
     * @param {Object} metrics - Metrics client.
     */
    constructor({namespace, intervalMilliseconds, logger, metrics}) {
        this._intervalMilliseconds = intervalMilliseconds
        this._logger = logger
        this._metrics = metrics
        this._timeoutId = null
        this._secrets = {}
        this._namespace = namespace
    }

    /**
     * Return current set of present secret names
     * @returns {Array} - secret names listing
     */
    get secretNames() {
        return Object.keys(this._secrets)
    }

    /**
     * Refresh Kubernetes secrets.
     * Set timeout for next refresh.
     */
    async _listAndRefreshSecrets() {

        const kubeSecrets = await this._namespace.secrets.get()
        for (const kubeSecret of kubeSecrets) {
            this._secrets[kubeSecret.metadata.name] = kubeSecret;
        }

        this._metrics.observeSync({
            name: 'all-internal-secrets-list',
            namespace: this._namespace,
            status: 'success'
        })

        this._timeoutId = setTimeout(this._listAndRefreshSecrets.bind(this), this._intervalMilliseconds)
    }

    /**
     * Find out if given secret exists in a namespace.
     * @param {Object} namespace A namespace object
     * @param {string} secretName Name of secret
     *
     * @returns {boolean} Promise object that always resolves with status of k8s secret existence.
     */
    secretPresent(secretName) {
        return (secretName in this._secrets)
    }

    /**
     * Start this secrets observer.
     */
    start() {
        this._logger.info(`starting kubernetes secrets observer for namespace ${this._namespace}.`)
        this._timeoutId = setTimeout(this._listAndRefreshSecrets.bind(this), this._intervalMilliseconds)
        return this
    }

    stop() {
        if (this._timeoutId != null) {
            clearTimeout(this._timeoutId);
        }
    }

    static getOrCreateSecretObserver(props) {
        const nsName = props.namespace.metadata.name

        if (!(nsName in KubernetesSecrets.secretObservers)) {
            KubernetesSecrets.secretObservers[nsName] =
                new KubernetesSecrets(props);
        }

        return KubernetesSecrets.secretObservers[nsName]
    }

}



module.exports = KubernetesSecrets
