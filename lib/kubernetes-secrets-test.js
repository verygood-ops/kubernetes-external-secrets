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

        kubeNamespaceMock = sinon.mock()
        kubeNamespaceMock.secrets = sinon.mock()
        kubeNamespaceMock.secrets.get = sinon.stub().resolves([fakeSecret1, fakeSecret2])
        kubeNamespaceMock.metadata = sinon.mock()

        sinon.stub(kubeNamespaceMock.metadata, 'name').get(() => {return 'ns1'})

        kubeNamespaceMock2 = sinon.mock()
        kubeNamespaceMock2.secrets = sinon.mock()
        kubeNamespaceMock2.metadata = sinon.mock()

        sinon.stub(kubeNamespaceMock2.metadata, 'name').get(() => {return 'ns2'})

    })

    afterEach(async () => {
        sinon.restore()
    })

    it('caches secret after creating', async () => {
        let os1 = KubernetesSecrets.getOrCreateSecretObserver(
            {
                namespace: kubeNamespaceMock,
                logger: loggerMock,
                metrics: metricsMock,
                intervalMilliseconds: 1000
            }
        )

        let os2 = KubernetesSecrets.getOrCreateSecretObserver(
            {
                namespace: kubeNamespaceMock,
                logger: loggerMock,
                metrics: metricsMock,
                intervalMilliseconds: 1000
            }
        )

        let os3 = KubernetesSecrets.getOrCreateSecretObserver(
            {
                namespace: kubeNamespaceMock2,
                logger: loggerMock,
                metrics: metricsMock,
                intervalMilliseconds: 1000
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
                intervalMilliseconds: 2000
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
                intervalMilliseconds: 2000
            }
        )
        await os._listAndRefreshSecrets()
        clearTimeout(os._timeoutId)
        expect(os.secretPresent('stub1')).equal(true)
        expect(os.secretPresent('stub3')).equal(false)

    })

})
