/* eslint-env mocha */
'use strict'

const { expect } = require('chai')
const sinon = require('sinon')

const KubernetesSecrets = require('./kubernetes-secrets')


describe('KubernetesSecrets', () => {
    let loggerMock
    let metricsMock
    let kubeNamespaceMock
    let kubeNamespaceMock2
    let kubeClientMock = sinon.mock()

    beforeEach(async () => {
        loggerMock = sinon.mock()
        loggerMock.info = sinon.stub()

        metricsMock = sinon.mock()
        metricsMock.observeSync = sinon.stub()


        const fakeSecret1 = {
            apiVersion: 'v1',
            kind: 'Secret',
            metadata: {
                name: 'stub1'
            }
        }

        const fakeSecret2 = {
            apiVersion: 'v1',
            kind: 'Secret',
            metadata: {
                name: 'stub2'
            }
        }

        kubeClientMock.api = sinon.mock()
        kubeClientMock.api.v1 = sinon.mock()
        kubeClientMock.api.v1.namespaces = sinon.stub().returns(kubeNamespaceMock)

        kubeNamespaceMock = sinon.mock()
        kubeNamespaceMock.get = sinon.stub().resolves(kubeNamespaceMock)
        kubeNamespaceMock.secrets = sinon.mock()
        kubeNamespaceMock.secrets.get = sinon.stub().resolves([fakeSecret1, fakeSecret2])


    })

    afterEach(async () => {
        sinon.restore()
    })

    it('caches secret after creating', async () => {
        let os1 = KubernetesSecrets.getOrCreateSecretObserver(
            {
                namespace: 'ns1',
                logger: loggerMock,
                metrics: metricsMock,
                intervalMilliseconds: 1000,
                kubeClient: kubeClientMock
            }
        )

        let os2 = KubernetesSecrets.getOrCreateSecretObserver(
            {
                namespace: 'ns1',
                logger: loggerMock,
                metrics: metricsMock,
                intervalMilliseconds: 1000,
                kubeClient: kubeClientMock
            }
        )

        let os3 = KubernetesSecrets.getOrCreateSecretObserver(
            {
                namespace: 'ns2',
                logger: loggerMock,
                metrics: metricsMock,
                intervalMilliseconds: 1000,
                kubeClient: kubeClientMock
            }
        )

        expect(os1).is.deep.equal(os2)
        expect(os3).is.not.equal(os2)
        expect(Object.keys(KubernetesSecrets.secretObservers)).is.deep.equal(['ns1', 'ns2'])

    })

    it('periodically refreshes internal secret state', async () => {

        let os = KubernetesSecrets.getOrCreateSecretObserver(
            {
                namespace: kubeNamespaceMock,
                logger: loggerMock,
                metrics: metricsMock,
                intervalMilliseconds: 2000,
                kubeClient: kubeClientMock
            }
        )
        await os._listAndRefreshSecrets()
        clearTimeout(os._timeoutId)
        expect(os.secretNames).is.deep.equal(['stub1', 'stub2'])

    })

    it('allows to testing of secret presence within state', async () => {

        let os = KubernetesSecrets.getOrCreateSecretObserver(
            {
                namespace: kubeNamespaceMock,
                logger: loggerMock,
                metrics: metricsMock,
                intervalMilliseconds: 2000,
                kubeClient: kubeClientMock
            }
        )
        await os._listAndRefreshSecrets()
        clearTimeout(os._timeoutId)
        expect(os.secretPresent('stub1')).equal(true)
        expect(os.secretPresent('stub3')).equal(false)

    })

})
