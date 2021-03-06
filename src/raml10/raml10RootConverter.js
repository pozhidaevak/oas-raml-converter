// @flow
const _ = require('lodash');
const ConverterModel = require('oas-raml-converter-model');
const Converter = require('../converters/converter');
const Info = ConverterModel.Info;
const MediaType = ConverterModel.MediaType;
const BaseUri = ConverterModel.BaseUri;
const Root = ConverterModel.Root;
const Resource = ConverterModel.Resource;
const Parameter = ConverterModel.Parameter;
const Header = ConverterModel.Header;
const Body = ConverterModel.Body;
const Definition = ConverterModel.Definition;
const Tag = ConverterModel.Tag;
const Item = ConverterModel.Item;
const Annotation = ConverterModel.Annotation;
const Response = ConverterModel.Response;
const ExternalDocumentation = ConverterModel.ExternalDocumentation;
const Raml10InfoConverter = require('../raml10/raml10InfoConverter');
const Raml10DefinitionConverter = require('../raml10/raml10DefinitionConverter');
const ParameterConverter = require('../common/parameterConverter');
const Raml10AnnotationConverter = require('../raml10/raml10AnnotationConverter');
const Raml10CustomAnnotationConverter = require('../raml10/raml10CustomAnnotationConverter');
const urlHelper = require('../utils/url');

class Raml10RootConverter extends Converter {

	constructor(model: Root) {
		super(model, 'oas');
	}

	export(model: Root) {
		return _.isEmpty(model) ? {} : this._export(model);
	}

	_export(model: Root) {
		const attrIdMap = {};
		const attrIdSkip = ['info', 'baseUri', 'baseUriParameters', 'mediaType', 'protocols', 'securityDefinitions', 'resources', 'types', 'resourceTypes', 'annotations', 'resourceAnnotations', 'tags', 'externalDocs', 'responses', 'documentation', 'error', 'warning'];
		const ramlDef = Raml10RootConverter.createRamlDef(model, attrIdMap, attrIdSkip);

		if (model.hasOwnProperty('info')) {
			const infoConverter = new Raml10InfoConverter(this.model, this.annotationPrefix, ramlDef);
			const info: Info = model.info;
			_.merge(ramlDef, infoConverter.export(info));
		}

		if (model.hasOwnProperty('tags') && model.tags) {
			const tags: Tag[] = model.tags;
			const tagsDef = [];
			for (let i = 0; i < tags.length; i++) {
				const tag: Tag = tags[i];
				const result = {};
				if (tag.hasOwnProperty('name')) result.name = tag.name;
				if (tag.hasOwnProperty('description')) result.description = tag.description;
				if (tag.hasOwnProperty('externalDocs')) {
					const externalDocs: ?ExternalDocumentation = tag.externalDocs;
					result.externalDocs = externalDocs;
				}
				if (!_.isEmpty(result)) {
					tagsDef.push(result);
				}
			}
			if (!_.isEmpty(tagsDef)) {
				const id = this.annotationPrefix + '-tags-definition';
				Raml10CustomAnnotationConverter._createAnnotationType(ramlDef, this.annotationPrefix, id);
				ramlDef['(' + id + ')'] = tagsDef;
			}
		}

		if (model.hasOwnProperty('mediaType') && model.mediaType) {
			const mediaType: MediaType = model.mediaType;
			if (mediaType.mimeTypes.length > 1) {
				ramlDef.mediaType = mediaType.mimeTypes;
			} else {
				ramlDef.mediaType = mediaType.mimeTypes[0];
			}
		}

		if (model.hasOwnProperty('protocols') && model.protocols) {
			const protocolsModel: string[] = model.protocols;
			const protocols = [];
			for (let i = 0; i < protocolsModel.length; i++) {
				const protocolModel: string = protocolsModel[i];
				protocols.push(protocolModel.toUpperCase());
			}
			ramlDef.protocols = protocols;
		}

		if (model.hasOwnProperty('baseUriParameters') && model.baseUriParameters) {
			const baseUriParameters: Parameter[] = model.baseUriParameters;
			if (_.isArray(baseUriParameters) && !_.isEmpty(baseUriParameters)) {
				const parameterConverter = new ParameterConverter(this.model, this.annotationPrefix, this.def, '');
				ramlDef.baseUriParameters = parameterConverter.export(baseUriParameters);
			}
		}

		if (model.hasOwnProperty('baseUri') && model.baseUri) {
			const baseUri: BaseUri = model.baseUri;
			if (baseUri.hasOwnProperty('annotations')) {
				const annotationConverter = new Raml10AnnotationConverter(this.model, this.annotationPrefix, ramlDef);
				ramlDef.baseUri = {value: baseUri.uri};
				_.assign(ramlDef.baseUri, annotationConverter._export(baseUri));
			} else
				ramlDef.baseUri = baseUri.uri;
		}

		if (model.hasOwnProperty('documentation') && model.documentation) {
			const documentationModel: Item[] = model.documentation;
			const documentation = [];
			for (let i = 0; i < documentationModel.length; i++) {
				const item: Item = documentationModel[i];
				const doc = {
					title: item.name,
					content: item.value
				};
				documentation.push(doc);
			}
			ramlDef.documentation = documentation;
		}

		if (model.hasOwnProperty('responses') && model.responses) {
			const responsesModel: Response[] = model.responses;
			const responses = {};
			for (let i = 0; i < responsesModel.length; i++) {
				const response: Response = responsesModel[i];
				const responseDef = {};
				if (response.hasOwnProperty('description')) responseDef.description = response.description;
				const headersDef = {};
				const definitionConverter = new Raml10DefinitionConverter();
				if (response.hasOwnProperty('headers') && response.headers) {
					const headers: Header[] = response.headers;
					for (let j = 0; j < headers.length; j++) {
						const header: Header = headers[j];
						const definition: ?Definition = header.definition;
						headersDef[header.name] = definitionConverter._export(definition);
					}
					if (!_.isEmpty(headersDef)) responseDef.headers = headersDef;
				}
				if (response.hasOwnProperty('bodies') && response.bodies) {
					const bodies: Body[] = response.bodies;
					for (let j = 0; j < bodies.length; j++) {
						const body = bodies[j];
						const definition: ?Definition = body.definition;
						responseDef.body = definitionConverter._export(definition);
					}
				}
				const name: ?string = response.name;
				if (name) responses[name] = responseDef;
			}

			if (!_.isEmpty(responses)) {
				const id = this.annotationPrefix + '-responses';
				Raml10CustomAnnotationConverter._createAnnotationType(ramlDef, this.annotationPrefix, id);
				ramlDef['(' + id + ')'] = responses;
			}
		}

		if (model.hasOwnProperty('externalDocs') && model.externalDocs) {
			const externalDocsModel: ExternalDocumentation = model.externalDocs;
			const id = this.annotationPrefix + '-externalDocs';
			Raml10CustomAnnotationConverter._createAnnotationType(ramlDef, this.annotationPrefix, id);
			const externalDocs = {};
			if (externalDocsModel.hasOwnProperty('url')) externalDocs.url = externalDocsModel.url;
			if (externalDocsModel.hasOwnProperty('description')) externalDocs.description = externalDocsModel.description;
			Raml10AnnotationConverter.exportAnnotations(this.model, this.annotationPrefix, ramlDef, externalDocsModel, externalDocs);
			ramlDef['(' + id + ')'] = externalDocs;
		}
		if (model.hasOwnProperty('resourceAnnotations') && model.resourceAnnotations) {
			const resourceAnnotationsModel: Resource = model.resourceAnnotations;
			const id = this.annotationPrefix + '-paths';
			Raml10CustomAnnotationConverter._createAnnotationType(ramlDef, this.annotationPrefix, id);
			const resourceAnnotations = {};
			Raml10AnnotationConverter.exportAnnotations(this.model, this.annotationPrefix, ramlDef, resourceAnnotationsModel, resourceAnnotations);
			ramlDef['(' + id + ')'] = resourceAnnotations;
		}
		Raml10AnnotationConverter.exportAnnotations(this.model, this.annotationPrefix, ramlDef, model, ramlDef);

		return ramlDef;
	}

	static exportAnnotations(model: Root, annotationPrefix: string, ramlDef: any, source: any, target: any) {
		if (source.hasOwnProperty('annotations') && _.isArray(source.annotations) && !_.isEmpty(source.annotations)) {
			const annotationConverter = new Raml10AnnotationConverter(model, annotationPrefix, ramlDef);
			_.assign(target, annotationConverter._export(source));
		}
	}

	import(ramlDef: any): Root {
		return _.isEmpty(ramlDef) ? new Root() : this._import(ramlDef);
	}

	_import(ramlDef: any) {
		const model = new Root();

		const infoConverter = new Raml10InfoConverter(model);
		infoConverter.version = this.version;
		model.info = infoConverter.import(ramlDef);

		if (ramlDef.hasOwnProperty('protocols')) {
			if (_.isArray(ramlDef.protocols)) {
				model.protocols = ramlDef.protocols.map(function (protocol) {
					return protocol.toLowerCase();
				});
			} else {
				model.protocols = [ramlDef.protocols.toLowerCase()];
			}
		}

		if (ramlDef.baseUri != null) {
			const baseUri = new BaseUri();
			const uri = ramlDef.baseUri;
			baseUri.uri = uri;
			const parsedURL = urlHelper.parseURL(uri);
			
			if (parsedURL.host != null && baseUri.uri != null) {
				const host: string = parsedURL.host;
				const index = baseUri.uri.indexOf(host);
				if (baseUri.uri != null && baseUri.uri.charAt(index + host.length) !== '{') {
					baseUri.host = host;
				}
			}
			if (parsedURL.pathname != null && parsedURL.pathname !== '/') {
				const basePath: string = parsedURL.pathname.replace(/%7B/g, '{').replace(/%7D/g, '}');
				if (!basePath.startsWith('{')) {
					baseUri.basePath = basePath;
				}
			}
			if (parsedURL.protocol != null) {
				baseUri.protocol = parsedURL.protocol.toLowerCase();
				if (model.protocols != null && baseUri.protocol != null && !_.includes(model.protocols, baseUri.protocol)) {
					model.protocols.push(baseUri.protocol);
				} else if (model.protocols == null && baseUri.protocol != null) {
					model.protocols = [baseUri.protocol];
				}
			}
			model.baseUri = baseUri;
			Raml10AnnotationConverter.importAnnotations(ramlDef.baseUri, model, model);
		}

		if (ramlDef.hasOwnProperty('baseUriParameters')) {
			if (!_.isEmpty(ramlDef.baseUriParameters)) {
				const parameterConverter = new ParameterConverter(this.model, this.annotationPrefix, this.def, '');
				const baseUriParameters: Parameter[] = [];
				for (const id in ramlDef.baseUriParameters) {
					if (!ramlDef.baseUriParameters.hasOwnProperty(id)) continue;

					const parameter: Parameter = parameterConverter._import(ramlDef.baseUriParameters[id]);
					baseUriParameters.push(parameter);
				}
				model.baseUriParameters = baseUriParameters;
			}
		}

		if (ramlDef.hasOwnProperty('mediaType')) {
			const mediaType = new MediaType();
			const mimeTypes: string[] = _.isArray(ramlDef.mediaType) ? ramlDef.mediaType : [ramlDef.mediaType];
			const mimes: string[] = [];
			for (let i = 0; i < mimeTypes.length; i++) {
				const mimeType: string = mimeTypes[i];
				if (!_.includes(mimes, mimeType)) mimes.push(mimeType);
			}
			mediaType.mimeTypes = mimeTypes;
			if (!_.isEmpty(mimes)) {
				mediaType.consumes = mimes;
				mediaType.produces = mimes;
			}
			model.mediaType = mediaType;
		}

		if (ramlDef.hasOwnProperty('documentation')) {
			const documentation: Item[] = [];
			for (let i = 0; i < ramlDef.documentation.length; i++) {
				const doc = ramlDef.documentation[i];
				const item = new Item();
				item.name = doc.title;
				item.value = doc.content;
				documentation.push(item);
			}

			model.documentation = documentation;
		}

		if (ramlDef.hasOwnProperty('annotations') || ramlDef.hasOwnProperty('scalarsAnnotations')) {
			const annotationsDef = ramlDef.annotations;
			if (annotationsDef.hasOwnProperty('oas-tags-definition')) {
				const tagDef = annotationsDef['oas-tags-definition'];
				delete ramlDef.annotations['oas-tags-definition'];
				const tags: Tag[] = model.tags ? model.tags : [];
				if (tagDef.hasOwnProperty('structuredValue')) {
					const structuredValue = tagDef.structuredValue;
					structuredValue.map(value => {
						const tag = new Tag();
						tag.name = value.name;
						if (value.hasOwnProperty('description')) tag.description = value.description;
						if (value.hasOwnProperty('externalDocs')) {
							const externalDocs = value.externalDocs;
							const result = new ExternalDocumentation();
							if (externalDocs.hasOwnProperty('description')) result.description = externalDocs.description;
							if (externalDocs.hasOwnProperty('url')) result.url = externalDocs.url;
							if (!_.isEmpty(result)) {
								tag.externalDocs = result;
							}
						}
						if (!_.isEmpty(tag)) {
							tags.push(tag);
						}
					});
				}
				if (!_.isEmpty(tags)) {
					model.tags = tags;
				}
			}

			if (annotationsDef.hasOwnProperty('oas-externalDocs')) {
				const externalDocsDef = annotationsDef['oas-externalDocs'].structuredValue;
				delete ramlDef.annotations['oas-externalDocs'];
				const externalDocs = new ExternalDocumentation();
				if (externalDocsDef.hasOwnProperty('url')) externalDocs.url = externalDocsDef.url;
				if (externalDocsDef.hasOwnProperty('description')) externalDocs.description = externalDocsDef.description;
				if (!_.isEmpty(externalDocs)) model.externalDocs = externalDocs;
			}

			const annotationConverter = new Raml10AnnotationConverter(model);
			const annotations: Annotation[] = annotationConverter._import(ramlDef);
			if (!_.isEmpty(annotations)) model.annotations = annotations;
		}

		return model;
	}

	static createRamlDef(root: Root, attrIdMap, attrIdSkip) {
		const result = {};

		_.assign(result, root);
		attrIdSkip.map(id => {
			delete result[id];
		});
		_.keys(attrIdMap).map(id => {
			result[attrIdMap[id]] = result[id];
			delete result[id];
		});

		return result;
	}

}

module.exports = Raml10RootConverter;
